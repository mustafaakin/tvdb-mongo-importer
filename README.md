# The TVDB MySQL to MongoDB Importer#

This application is mainly build for [www.ollaa.com](Ollaa).

## Usage ##

In the project folder you must install the dependent packages (mysql & mongoose) and run the project by:
	
	npm install mysql
	npm install mongoose
	node importer
	
## Mongoose Document ##

Preffered mongodb document is shown below.

	{
        "created" : ISODate("2012-01-26T11:53:53.265Z"),
        "_id" : ObjectId("4f213ed1ffc2567c0c000b1d"),
        "features" : {
                "imdb_id" : "tt0934814",
                "released" : "2007-09-24",
                "tvdb_id" : 80348,
                "type" : "series",
                "names" : [
                        "Chuck"
                ],
                "pictures" : [
                        "http://thetvdb.com/banners/posters/80348-1.jpg"
                ],
                "cast" : [
                        "Zachary Levi",
                        "Adam Baldwin",
                        "Yvonne Strzechowski"
                ],
                "genres" : [
                        "Action and Adventure",
                        "Comedy",
                        "Drama"
                ]
        },
        "type" : 1
	}

## Config File ## 

Remember to edit the config.js file to fullfil your needs.

	config.mysql = {
		host: "localhost",
		port: 3306,
		user: "root",
		password: "", 
	}

	config.mongo = {
		host: "localhost",
		port: 27017,
		user: "root",
		password: "123",
		database: "thetvdb",
		collection: "series"
	}

