var isPictureMode = false;
if ( process.argv[2] && process.argv[2] == "-p"){
	isPictureMode = true;
	console.log("PICTURE DOWNLOAD MODE");
	
}
// Requirements
var http    = require('http');
var fs  = require('fs');
var path = require('path');
var im = require('imagemagick');
var mysql = require('mysql');
var mongoose = require('mongoose');
var config = require('./config');

var mysqlOptions = config.mysql;
var mongoOptions = config.mongo;

var MONGO_CONNECTION_STRING = "mongodb://" + mongoOptions.user + ":" + mongoOptions.password + "@" + mongoOptions.host + ":" + mongoOptions.port + "/" + mongoOptions.database;

// Definitions
var IMAGE_PREFIX = "http://thetvdb.com/banners/_cache/";
var IMAGE_MONGO_PREFIX = "http://ollaa.blob.core.windows.net/tvpics/";

var Schema = mongoose.Schema
  , ObjectId = Schema.ObjectId;
  
var seriesSchema = new Schema({
	type : {type: Number, default: 1},
	features: {
		rating: Number,
		genres: [String],
		tvdb_id: {type: Number, unique: true},
		cast: [String],
		pictures: [String],
		imdb_id: String,
		released: String,
		names : [String],
		type : {type: String, default: "series"}
	},
	created : {type: Date}
});

// Connections  
var clientMongo  = mongoose.createConnection(MONGO_CONNECTION_STRING, function(err){
	if ( err){
		throw err;
	}
});

var clientSeries = mysql.createClient(mysqlOptions);
var clientBanners = mysql.createClient(mysqlOptions);
var clientNames = mysql.createClient(mysqlOptions);
var SeriesModel = clientMongo.model(mongoOptions.collection, seriesSchema, mongoOptions.collection); // Work-around weird pluralization of Mongoose.

// Actual Code
clientSeries.query('USE ' + mysqlOptions.database);
clientBanners.query('USE ' + mysqlOptions.database);
clientNames.query('USE ' + mysqlOptions.database);

clientSeries.query(
  'SELECT id, SeriesName, FirstAired, Genre, Actors, IMDB_ID FROM tvseries WHERE SeriesName IS NOT NULL AND FirstAired > "1990-00-00"',
  function select(err, results, fields) {
	for (var i = 0; i < results.length; i++){
		var serieId = results[i].id;
		fetchBoth(serieId, results[i], i, results.length);
		
		function fetchBoth(serieId, serieData, index, max){
			var images, names;			
			getImages(serieId, function(filenames){
				if ( isPictureMode && filenames && filenames.length > 0){
					var img_path =  __dirname + '/tmp/' + serieId + ".jpg";
					if (!path.existsSync(img_path)){
						console.log("Downloading: " + serieId); 
						getImg("www.thetvdb.com", "/banners/" + filenames[0].filename, img_path, function(err){								
							if ( !err){
								resize(true, serieId);
							}
						});
					}					
				}
				
				getNames(serieId, function(aka){
					if ( max - 1 == index){ // Finished, exit the program.
						setTimeout(function(){
							mongoose.disconnect();
							clientSeries.end();
							clientBanners.end();
							clientNames.end();
						}, 2500);
					}
					var seriesName = [serieData.SeriesName];
					if ( aka && aka.length > 0){
						// Combining additional names, primary name at the beginning.
						for ( var i = 0; i < aka.length; i++){
							var currName = aka[i].name;
							if ( currName != serieData.SeriesName){
								seriesName.push(currName);
							}
						}
					} 
					if ( seriesName.length < 0 || seriesName[0] == ""){
						return;
					}
					SeriesModel.findOne({"features.tvdb_id": serieData.id}, function(err, instance) {
						if ( !err) {
							if(!instance) {
								var instance = new SeriesModel();
							}
							
							// Must-Exist Values
							instance.created = new Date(); 
							instance.features.tvdb_id = serieData.id;
							instance.features.names  = seriesName;
							
							// Optional Values Due to TVDB
							var genres = normalizeArray(serieData.Genre);
							if ( !instance.features.genres && genres && genres.length > 0){
								instance.features.genres = genres;
							} 
							
							if ( instance.features.pictures.length <= 0 && filenames && filenames.length > 0){
								var pictures = [serieId + "_s.jpg", serieId + ".jpg"];
								instance.features.pictures = pictures;
							} 
							
							var cast = normalizeArray(serieData.Actors);
							if ( instance.features.cast.length <= 0 && cast && cast.length > 0){
								instance.features.cast = cast;
							}							
							
							if ( !instance.features.released && serieData.FirstAired){
								instance.features.released = serieData.FirstAired;	
							}
							
							if ( !instance.features.imdb_id && serieData.IMDB_ID){
								instance.features.imdb_id = serieData.IMDB_ID;					
							} 
							instance.save(function(err) {
								if ( err){
									console.log("Could not save to db!");
									console.log(err);
								}
							});
						}						
					});
				});
			});		
		}	
	}	
  }
)


function getImages(serieId, callback){
	clientBanners.query(
	'SELECT filename FROM banners WHERE keytype = "poster" AND keyvalue = ' + serieId,
	function select(err, results, fields) {
		callback(results);
	});		
}

function getNames(serieId, callback){
	clientNames.query(
	'SELECT distinct(name) FROM aka_seriesname WHERE seriesid = ' + serieId,
	function select(err, results, fields){
		callback(results);
	});
}	

function normalizeArray(array){
	if ( !array)
		return null;
	var refined = array.split("|");
	/* For removing first and last elements. Can be replaced with more safe operation.
	 * Because mainly actors/genre filed is |ACTOR1|ACTOR2| which makes first and last 
	 * element empty with split('|') operation.
	 */
	return refined.splice(1, refined.length - 2);
}

var getImg = function(hst, pth, dest, cb, retry){
    var options = {
      host: hst,
      port: 80,
      path: pth
    };	
    http.get(options, function(res) {
        res.setEncoding('binary');
        var imagedata = '';
        res.on('data', function(chunk){
            imagedata+= chunk; 
        });
        res.on('end', function(){
            fs.writeFile(dest, imagedata, 'binary', cb);
        });
    }).on('error', function(e) {
		if ( !retry){
			retry = 0;
		}
		if ( retry < 5){
			setTimeout(1000, getImg(hst, pth, dest, cb, retry + 1));
		} else {
			console.log("5 retries failed." + pth)
		}
    });
}
function resize(small,id,trial){
	im.resize({
		srcPath: __dirname + '/tmp/' + id + ".jpg",
		dstPath: (__dirname + '/tmp/' + id ) + (small ? "_s" : "") + ".jpg",
		width: small ? 92: 480
	}, function(err, stdout, stderr){		
		if (err){
			if ( !trial)
				trial = 0;
			if ( trial < 5){
				resize(small, id, trial);
			} else {
				console.log("resize after 5 trials failed at:" + id);
			}
		} else {
			if ( small){
				setTimeout(1000, resize(!small, id));
			}		
		}
	});
}