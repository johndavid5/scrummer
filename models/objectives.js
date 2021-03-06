var deepcopy = require('deepcopy');
//var TYPES = require('tedious-ntlm').TYPES

var jutils = require('../jutils'); // jutils.js
var sharedUtils = require('../ng/shared-utils.svc.js'); 

//var log4js = require('../lib/log4js-node/lib/log4js');
//var logger = log4js.getLogger();
var logger = require('../logger'); 

var config = require('../config'); 

//var Database = require('../Database'); // Database.js
//var Entity = require('./entity'); // use to get Entity's associated with a filing...
//var Person = require('./person'); // use to get Person' associated with a filing...
//var Company = require('./company'); // use to get Company's associated with a filing...
var MongoClient = require('mongodb').MongoClient;

var ObjectID = require('mongodb').ObjectID; // use to convert string to ObjectID

//var MongoUtils = require('../mongoutils');

var test = require('assert');


function Objectives(){

	//this.database = new Database();


	// Place copy of this into outerThis as "closure" (or "private member") so you can see this as outerThis inside the callbacks...
	var outerThis = this; 

	this.getObjectives = function( options, callback ){

		var sWho = "Objectives::getObjectives";

		console.log(sWho + "(): options = " + JSON.stringify( options ) );

		if( options == null ){
			options = {};
		}

		logger.info(sWho + "(): Connecting to \"" + config.mongoDbScrummerUrl + "\"...");

		MongoClient.connect(config.mongoDbScrummerUrl, function connectCallback(err, db) {
			var sWho = "connectCallback";

			if( err ){
				logger.error(sWho + "(): Trouble with connect: \"" + err + "\"...");
				var rows = [
					{ error: err }
				];
				callback( rows, 0, err );
				return;
			}

			logger.info(sWho + "(): Using collection \"" + config.mongoDbScrummerObjectivesCollection + "\"...");
  			var collection = db.collection( config.mongoDbScrummerObjectivesCollection );

			//var query = {};
			//var query = { "form_processing_attempts.success" : { "$eq": true } };
			//var query = { "dn_denormalized" : { "$eq": true }, "dn_company_conformed_name": { "$ne": "" } };
			var query = {};

			if( options.accessionNumber ){
				// For example the Form Details page...
				query.accession_number = { "$eq": options.accessionNumber };
			}

			if( options.project_filter ){
				// MongoDB 2.4: You can also use text index...
				// see http://stackoverflow.com/questions/10610131/checking-if-a-field-contains-a-string
				// e.g., { <field>: { $regex: /pattern/, $options: '<options>' } }
				query.project = { "$regex": new RegExp('.*' + options.project_filter + '.*', 'i') };
			}

			if( options.task_filter ){
				// MongoDB 2.4: You can also use text index...
				// see http://stackoverflow.com/questions/10610131/checking-if-a-field-contains-a-string
				// e.g., { <field>: { $regex: /pattern/, $options: '<options>' } }
				query.task_name = { "$regex": new RegExp('.*' + options.task_filter + '.*', 'i') };
			}

			if( options.assigned_to_filter ){
				query.assigned_to = { "$regex": new RegExp('.*' + options.assigned_to_filter + '.*', 'i') };
			}

			if( options.duration_filter ){
				query.duration = { "$regex": new RegExp('.*' + options.duration_filter + '.*', 'i') };
			}

			if( options.percent_complete_filter ){
				query.percent_complete = { "$regex": new RegExp('.*' + options.percent_complete_filter + '.*', 'i') };
			}

			if( options.status_filter ){
				query.status = { "$regex": new RegExp('.*' + options.status_filter + '.*', 'i') };
			}

			if( options.comments_filter ){
				query.comments = { "$regex": new RegExp('.*' + options.comments_filter + '.*', 'i') };
			}


			if( options.start_date_from_filter && sharedUtils.isDateStringValid(options.start_date_from_filter) ){
				query.start = { "$gte": options.start_date_from_filter }; 
			}

			if( options.start_date_to_filter && sharedUtils.isDateStringValid(options.start_date_to_filter) ){
				if( query.start ){
					// query.start object already exists, so set "$lte" field...
					query.start["$lte"] = options.start_date_to_filter; 
				}
				else {
					// query.start object does not already exist, so create it...
					query.start = { "$lte": options.start_date_to_filter }; 
				}
			}

			if( options.finish_date_from_filter && sharedUtils.isDateStringValid(options.finish_date_from_filter) ){
				query.finish = { "$gte": options.finish_date_from_filter }; 
			}

			if( options.finish_date_to_filter && sharedUtils.isDateStringValid(options.finish_date_to_filter) ){
				if( query.finish ){
					// query.finish object already exists, so set "$lte" field...
					query.finish["$lte"] = options.finish_date_to_filter; 
				}
				else {
					// query.finish object does not already exist, so create it...
					query.finish = { "$lte": options.finish_date_to_filter }; 
				}
			}

			if( options.filer_name_filter ){
				// e.g., { <field>: { $regex: /pattern/, $options: '<options>' } }
				query.dn_company_conformed_name = { "$regex": new RegExp('.*' + options.filer_name_filter + '.*', 'i') };
			}

			if( options.filer_cik_filter ){
				// e.g., { <field>: { $regex: /pattern/, $options: '<options>' } }
				query.dn_company_central_index_key = { "$regex": new RegExp('.*' + options.filer_cik_filter + '.*', 'i') };
			}

			logger.info(sWho + "(): query = ", query, "..."); 

			if( options.countOnly ){

				logger.info(sWho + "(): Calling collection.count()...");

  				collection.count(query, function countCallback(err, count){

					var sWho = "countCallback";

					if( err ){
						logger.error(sWho + "(): Trouble with count: \"" + err + "\"...");
						var rows = [
							{ error: err }
						];
						callback( rows, 0, err );
						return;
					}

					logger.info(sWho + "(): Returning count = " + count + " to callback...");
					var rows = [
						{ "count": count }
					];
					callback( rows, count, null );  
					logger.info(sWho + "(): Calling db.close() and returning from function...");
					db.close();
					return;
				});
			}
			else {
				var iSkip;
				var iLimit;

				if( ! options.lowRow && ! options.highRow ){
					iSkip = 0;
					iLimit = 100;
				}
				else {
					// Cast them to integers to avoid hanky-panky...
					options.lowRow = parseInt(options.lowRow);
					options.highRow = parseInt(options.highRow);

					// Insanity Check...
					if(options.lowRow < 0){
						options.lowRow = 0;
					}

					// Insanity Check...
					if(options.highRow < 0){
						options.highRow = 0;
					}

					// Insanity Check: swap them if lowRow is not less than or equal to highRow
					if(options.lowRow > options.highRow){
						var temp = options.highRow;
						options.highRow = options.lowRow;
						options.lowRow = options.highRow;
					}

					iSkip = options.lowRow - 1;
					iLimit = options.highRow - options.lowRow + 1;
				}


				var sort = {};

				if( options.orderBy ){

					if( options.orderBy == "project" ){
						if( options.ascDesc == "desc" ){
							sort = {"project": -1 };
						}
						else {
							sort = {"project": 1 };
						}
					}
					else if( options.orderBy == "task_name" ){
						if( options.ascDesc == "desc" ){
							sort = {"task_name": -1 };
						}
						else {
							sort = {"task_name": 1 };
						}
					}
					else if( options.orderBy == "assigned_to" ){
						if( options.ascDesc == "desc" ){
							sort = {"assigned_to": -1 };
						}
						else {
							sort = {"assigned_to": 1 };
						}
					}
					else if( options.orderBy == "duration" ){
						if( options.ascDesc == "desc" ){
							sort = {"duration": -1 };
						}
						else {
							sort = {"duration": 1 };
						}
					}

					else if( options.orderBy == "percent_complete" ){
						if( options.ascDesc == "desc" ){
							sort = {"percent_complete": -1 };
						}
						else {
							sort = {"percent_complete": 1 };
						}
					}
					else if( options.orderBy == "start" ){
						if( options.ascDesc == "desc" ){
							sort = {"start": -1 };
						}
						else {
							sort = {"start": 1 };
						}
					}
					else if( options.orderBy == "finish" ){
						if( options.ascDesc == "desc" ){
							sort = {"finish": -1 };
						}
						else {
							sort = {"finish": 1 };
						}
					}
					else if( options.orderBy == "status" ){
						if( options.ascDesc == "desc" ){
							sort = {"status": -1 };
						}
						else {
							sort = {"status": 1 };
						}
					}
					else if( options.orderBy == "comments" ){
						if( options.ascDesc == "desc" ){
							sort = {"comments": -1 };
						}
						else {
							sort = {"comments": 1 };
						}
					}


				}/* if( options.orderBy ) */

				console.log(sWho + "(): Calling collection.find(), query = ", query, "sort = ", sort, "skip=" + iSkip + ", limit=" + iLimit + "...");

  				collection.find(query).sort(sort).skip(iSkip).limit(iLimit).toArray(function findCallback(err, items) {

					var sWho = "findCallback";

					if( err ){
						logger.error(sWho + "(): Trouble with count: \"" + err + "\"...");
						var rows = [
							{ error: err }
						];
						callback( rows, 0, err );
						return;
					}

					//items = [{"qty":4, "item":"Calling Birds"},{"qty":3, "item": "French Hens"},{"qty":2, "item": "Turtle Doves"},{"qty":1, "item": "Partridge in a Pear Tree"}];

					logger.info(sWho + "(): items.length = " + items.length + "...");
					if( items.length >= 1 ){
						logger.info(sWho + "(): items[0] = ", items[0], "...");
					}

					logger.info(sWho + "(): Returning items = ",  items, " to callback...");
					//logger.info(sWho + "(): Returning items to callback...");

					callback( items, items.length, null );

					logger.info(sWho + "(): Calling db.close() and returning from function...");
					db.close();

					return;
				});

			}/* else */

		});/* MongoClient.connect(config.mongoDbUrl, function connectCallback(err, db) */

	}; /* getObjectives() */


	this.createObjective = function( objective, callback ){

		var sWho = "Objectives::createObjective";
		logger.info( sWho + "(): objective = ", objective );

		var doc = { 
			"project": objective.project,
			"task_name": objective.task_name,
			"assigned_to": objective.assigned_to,
			"duration": objective.duration,
			"percent_complete": objective.percent_complete,
			"start": objective.start,
			"finish": objective.finish,
			"status": objective.status,
			"comments": objective.comments,
			"source_modified": objective.source_modified
		};

		logger.info(sWho + "(): Connecting to \"" + config.mongoDbScrummerUrl + "\"...");

		MongoClient.connect(config.mongoDbScrummerUrl,
			function connectCallback(err, db) {
				var sWho = "connectCallback";

				logger.info(sWho + "(): Using collection \"" + config.mongoDbScrummerObjectivesCollection + "\"...");

  				var collection = db.collection( config.mongoDbScrummerObjectivesCollection );

				logger.info(sWho + "(): Calling collection.insertOne(" ,
				"doc = ", doc, "...");	 

				collection.insertOne( doc ) 
				.then( function insertOneCallback(result){

					var sWho = "insertOneCallback";

					logger.info(sWho + "(): result = ", result );

					collection.findOne( doc )
					.then(function(item){							

						logger.info(sWho + "(): item from findOne() = ", item );

						// Pass the item to the callback...
						callback( [ item ], 1, undefined );

					});

				});
				


		});
	}; /* createObjective() */


	this.updateObjective = function( objective, callback ){

		var sWho = "Objectives::updateObjective";
		logger.info( sWho + "(): objective = ", objective );

		var query = { _id: new ObjectID( objective._id )  };
		var update = { 
			"project": objective.project,
			"task_name": objective.task_name,
			"assigned_to": objective.assigned_to,
			"duration": objective.duration,
			"percent_complete": objective.percent_complete,
			"start": objective.start,
			"finish": objective.finish,
			"status": objective.status,
			"comments": objective.comments,
			"source_modified": objective.source_modified
		};

		logger.info(sWho + "(): Connecting to \"" + config.mongoDbScrummerUrl + "\"...");

		MongoClient.connect(config.mongoDbScrummerUrl,
			function connectCallback(err, db) {
				var sWho = "connectCallback";

				logger.info(sWho + "(): Using collection \"" + config.mongoDbScrummerObjectivesCollection + "\"...");

  				var collection = db.collection( config.mongoDbScrummerObjectivesCollection );

				logger.info(sWho + "(): Calling collection.updateOne(" ,
				"query = ", query, ", update = ", update , "...");	 

				collection.updateOne( query, update ) 
				.then( function(result){

					logger.info(sWho + "(): result = ", result );

					collection.findOne( query )
					.then(function(item){							

						logger.info(sWho + "(): item from findOne() = ", item );

						// Pass the item to the callback...
						callback( [ item ], 1, undefined );

					});

				});
				


		});
	}; /* updateObjective() */


	this.deleteObjective = function( objective, callback ){

		var sWho = "Objectives::deleteObjective";
		logger.info( sWho + "(): objective = ", objective );

		var filter = { _id: new ObjectID( objective._id )  };
		var options = { };

		logger.info(sWho + "(): Connecting to \"" + config.mongoDbScrummerUrl + "\"...");

		MongoClient.connect(config.mongoDbScrummerUrl,
			function connectCallback(err, db) {
				var sWho = "connectCallback";

				logger.info(sWho + "(): Using collection \"" + config.mongoDbScrummerObjectivesCollection + "\"...");

  				var collection = db.collection( config.mongoDbScrummerObjectivesCollection );

				logger.info(sWho + "(): Calling collection.deleteOne(" ,
				"filter = ", filter, ", options = ", options, "...");	 

				collection.deleteOne( filter, options ) 
				.then( function deleteCallback(result){

					var sWho = "deleteCallback";

					logger.info(sWho + "(): result = ", result );

					collection.count( filter )
					.then(function countCallback(count){							

						logger.info(sWho + "(): SHEMP: Count should now be zero, Moe...count( ", filter, " ) = ", count );
						// Should have been removed, so count
						// should be zero...
						test.equal(0, count); 

						// Pass the item to the callback...
						callback( [ objective ], 1, undefined );

					});

				});
				


		});
	}; /* deleteObjective() */


	this.getFormTypes = function( options, callback ){

		var sWho = "Form::getFormTypes";

		console.log(sWho + "(): options = " + JSON.stringify( options ) );

		if( options == null ){
			options = {};
		}

		logger.info(sWho + "(): Connecting to \"" + config.mongoDbUrl + "\"...");

		MongoClient.connect(config.mongoDbUrl, function(err, db) {

			if( err ){
				logger.error(sWho + "(): Trouble with connect: \"" + err + "\"...");
				var rows = [
					{ error: err }
				];
				callback( rows, 0, err );
				return;
			}

			logger.info(sWho + "(): Using collection \"" + config.mongoDbFormsCollection + "\"...");
  			var collection = db.collection( config.mongoDbFormsCollection );

			//var query = {};
			//var query = { "form_processing_attempts.success" : { "$eq": true } };
			//var query = { "dn_denormalized" : { "$eq": true } };
			var query = { "dn_denormalized" : { "$eq": true }, "dn_company_conformed_name": { "$ne": "" } };

			var field = "form_type";
			console.log(sWho + "(): Calling collection.distinct( \"" + field + "\", ", query, " )...");

			collection.distinct( field, query, function(err, items) {

				if( err ){
					logger.error(sWho + "(): Trouble with count: \"" + err + "\"...");
					var rows = [
						{ error: err }
					];
					callback( rows, 0, err );
					return;
				}

				logger.info(sWho + "(): items.length = " + items.length + "...");
				if( items.length >= 1 ){
					logger.info(sWho + "(): items[0] = " + items[0] + "...");
				}
				if( items.length >= 2 ){
					logger.info(sWho + "(): items[1] = " + items[1] + "...");
				}
				if( items.length >= 3 ){
					logger.info(sWho + "(): items[2] = " + items[2] + "...");
				}
				//logger.info(sWho + "(): Returning items = ",  items, " to callback...");
				logger.info(sWho + "(): Returning items to callback...");

				callback( items, items.length, null );

				logger.info(sWho + "(): Calling db.close() and returning from function...");
				db.close();
				return;

			});/* collection.distinct( field, query, function(err, items) */

		});/* MongoClient.connect(config.mongoDbUrl, function(err, db) */

	}; /* getFormTypes() */

	this.getFormsFaux = function( options, callback ){

		var sWho = "Form::getForms";

		console.log(sWho + "(): options = " + JSON.stringify( options ) );

		if( options == null ){
			options = {};
		}

		var filingErr = null;

		if( options.countOnly ){
			var filingRows = [
				{ count: "3" }
			];
			callback( filingRows, 3, filingErr );  
			return;
		}

		var filingRows = [
			{ accession_number: "1", form_type: "D", date_filed: "2016-09-18", company_name: "ACME Plumbing", company_cik: "112233" },
			{ accession_number: "2", form_type: "10-K", date_filed: "2016-09-19", company_name: "Kovacs Plumbing", company_cik: "112234" },
			{ accession_number: "3", form_type: "10-Q", date_filed: "2016-09-20", company_name: "ABC Plumbing", company_cik: "112235" },
		];
		callback( filingRows, filingRows.length, filingErr );  

ngoClient.connect('mongodb://localhost:27017/test', function(err, db) {

  // Get a collection
  var collection = db.collection('update_a_simple_document_upsert_with_promise');
  // Update the document using an upsert operation, ensuring creation if it does not exist
  collection.updateOne({a:1}, {b:2, a:1}, {upsert:true, w: 1})
	.then(function(result) {
    test.equal(1, result.result.n);

    // Fetch the document that we modified and check if it got inserted correctly
    collection.findOne({a:1}).then(function(item) {
      test.equal(1, item.a);
      test.equal(2, item.b);
      db.close();
    });
  });
});
	}; /* getFormsFaux() */

	

} /* function Objectives() */

module.exports = Objectives;


