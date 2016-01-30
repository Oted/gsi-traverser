console.log('hi');
require('dotenv').load();
var RUN_TIME = 60000 : 1000 * 60 * 60 * 4;

var fs              = require('fs'),
    Async           = require('async'),
    Hoek            = require('hoek'),
    Utils           = require('./lib/utils.js'),
    Mongoose        = require('mongoose'),
    TimeStamp       = require('mongoose-times'),
    Injector        = require('./lib/injector.js'),
    Ejector         = require('./lib/ejector.js'),
    Scraper         = require('./lib/scraper.js'),
    requestSpan     = process.argv.length === 3 ? ,
    internals       = {};

internals.init = function(mappings) {
    console.log('Initializing...');

    internals.setUpDb(function(err, ItemModel) {
        if (err) {
            throw err;
        }
    
        var injector = new Injector(Math.floor(requestSpan / 2), ItemModel);
        var ejector = new Ejector(ItemModel);

        internals.initEject(ejector, ItemModel);
        internals.initInject(injector, mappings, ItemModel);
    });
}


/**
 * Init function for the ejector.
*/
internals.initEject = function(ejector, ItemModel) {
    console.log('starting a new ejection session');
    console.time('eject');
        
    ejector.getToWork(Math.floor(requestSpan / 4), function(err, totals) {
        if (err) {
            throw err;
        }

        console.timeEnd('eject');
        console.log(new Date());
        console.log(JSON.stringify(totals, null, " "));
        return internals.initEject(ejector, ItemModel);
    }); 
};


/**
 *  Init function for adding items 
 */
internals.initInject = function(injector, mappings, ItemModel) {
    console.log('starting a new injection session');
    console.time('inject');

    //iterate over all mappings and scraper them 
    Async.map(mappings, internals.scrapeMapping, function(err, results) {
        results = Hoek.flatten(results || []);
        
        //do some filtering and fixes
        results = results.filter(function(item) {
            if (!item || !item.data) { 
                return false 
            };
            
            return true;
        }).map(function(item) {
            if (!item.source) {
                item.source = Utils.extractSourceFromData(item);
            }

            return item;
        });

        //console.log(JSON.stringify(results, null, ' '));

        injector.injectMultiple(results, function(err, totals) {
            if (err) {
                throw err;
            }

            console.log('this run took : ');
            console.timeEnd('inject');
            console.log(new Date());
            console.log(JSON.stringify(totals, null, " "));
            return internals.initInject(injector, mappings, ItemModel);
        });
    });
};

/**
 *  Completely scrapes a mapping file and callbacks when done
 */
internals.scrapeMapping = function(file, done) {
    try {
        var mapping = require('./mappings/' + file);
        scraper.scrape(file, mapping, done); 
    } catch (err) {
        return done(err); 
    }
};

//if mapping file is provided, just debug it
if (process.argv.length === 3) {
    var mappingFile = process.argv[2];

    internals.scrapeMapping(mappingFile, function(err, results) {
        results = Hoek.flatten(results);
        console.log(JSON.stringify(results, null, " "));
    });
} else {
    fs.readdir('./mappings/', function(err, files) {
        if (err) {
            throw err;
        } 

        var isJson = /\.json$/;
        var mappings = files.filter(function(file) {
            return isJson.test(file);
        });
       
        //and one at runstart
        internals.init(mappings);
    });
}

/**
 * Set up dd
 */
internals.setUpDb = function(callback) {
    //enum schema types
    var itemTypes       = ['youtube', 'img', 'gif', 'gifv', 'soundcloud', 'vimeo', 'vine', 'text', 'video', 'instagram', 'twitch', 'ted', 'sound', 'other'];
    
    Mongoose.connect(process.env.MONGO_URL, function(err, res) {
        if (err) {
            return done(err);
        }

        //item schema
        var itemSchema = new Mongoose.Schema({
            _hash   : { type : String, unique : true },
            _sort   : { type : String },
            title   : { type : String },
            type    : { type: String, enum: itemTypes },
            data    : { type : Mongoose.Schema.Types.Mixed, required : 'Data is required.' },
            source  : { type : String },
            score   : { type : Number, default : 0 },
            ip      : { type : String },
            scraped : { type : Boolean, default : false },
            enabled : { type : Boolean, default : true }
        }).plugin(TimeStamp);
        
        //item model
        ItemModel = Mongoose.models.Item ? Mongoose.model('Item') : Mongoose.model('Item', itemSchema);
        return callback(null, ItemModel);
    });
}

/**
 *  Close connection
 */
internals.close = function() {
    console.log('Closing db!');
    ItemModel = RatingModel = AddjectiveModel = null;
    Mongoose.connection.close();
};


//on uncaught
process.on('uncaughtException', function(err) {
    throw err;
    console.log('Caught exception: ' + err);
});