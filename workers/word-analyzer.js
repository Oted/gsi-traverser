var Async       = require('async');
var Request     = require('request');
var L           = require('../lib/logger.js');
var _           = require('lodash');
var forbidden   = require('../data/forbidden_words.json');

var internals = {
    'score_threshold' : 75,
    'accepted_threshold' : 6,
    'word_origin_hash' : {},
    'all_words_occurrences' : {},
    'accepted_words' : {},
    'best_words' : {},
    'max_occurrance' : 0,
    'median_occurrance' : 0
};

/**
 * Worker for analyzing the words in the titles 
 */
module.exports = function(model, items, done) {
    if (!items || !items.length) {
        return done(null, internals.count);
    }

    L('Analyzer is dealing with ' + items.length + ' items..');

    items.forEach(function(item) {
        var title = item.toObject().title.trim().toLowerCase();

        var words = title.split(' ').map(function(word) {
            return word.replace(/\W+/g, " ")
                       .replace("'s",'')
                       .trim();
        }).filter(function(word) {
            return word.length >= 3;
        });

        words.forEach(function(word) {
            if (forbidden[word]) {
                return;
            }
            
            if (!internals.word_origin_hash[word]) {
                internals.word_origin_hash[word] = {};
            }

            internals.word_origin_hash[word][item.id] = item;

            if (internals.all_words_occurrences[word]) {
                internals.all_words_occurrences[word]++;
                
                if (internals.all_words_occurrences[word] >= internals.accepted_threshold) {
                    internals.accepted_words[word] = internals.all_words_occurrences[word];
                    
                    if (internals.all_words_occurrences[word] > internals.max_occurrance) {
                        internals.max_occurrance = internals.all_words_occurrences[word];
                    }
                }
            } else {
                internals.all_words_occurrences[word] = 1;
            }
        });
    });
    
    Object.keys(internals.accepted_words).forEach(function(word) {
        internals.median_occurrance += internals.accepted_words[word];

        if (internals.accepted_words[word] >= internals.max_occurrance - 10) {
            internals.best_words[word] = internals.accepted_words[word];
        }
    });
    
    internals.median_occurrance = Math.floor(internals.median_occurrance / Object.keys(internals.accepted_words).length);

    return Async.eachLimit(Object.keys(internals.accepted_words), 3, function(word, next) {
        model.findOne({ string: word }, function (err, doc) {
            if (err) {
                return next(err);
            }

            if (!doc) {
                L('Creating fragment ' + word + ' with score ' + internals.accepted_words[word] * word.length);
                var newFragment = new model({
                    'string' : word,
                    'count' : 1,
                    'total' : internals.accepted_words[word],
                    'median' : internals.accepted_words[word],
                    'score' : internals.accepted_words[word] * word.length
                });

                return newFragment.save(function(err, newDoc) {
                    return addFragmentToItems(newDoc, word, next);
                });
            }
             
            L('Updating fragment ' + word + ' with score ' + internals.accepted_words[word] * word.length);

            doc.count++;
            doc.total+= internals.accepted_words[word];
            doc.score = internals.accepted_words[word] * word.length;
            doc.median = doc.total / doc.count;
            return doc.save(function(err, newDoc) {
                return addFragmentToItems(newDoc, word, next);
            });
        });
    }, function(err) {
        if (err) {
            return done(err);
        }

        return done(null, internals);
    })    
    
    return done(null, internals['best_words']);
};

/**
 *  Add the word to 
 */
var addFragmentToItems = function(doc, word, done) {
    if (doc.score < internals.score_threshold) {
        return done();
    }

    return Async.eachLimit(Object.keys(internals.word_origin_hash[word]), 3, function(id, next) {
        var item = internals.word_origin_hash[word][id];

        if (item.fragments.indexOf(word) < 0) {
            L('Adding fragment ' + word + ' to ' + item.title);
            item.fragments.push(word);
        }

        return item.save(next);
    }, done);
};
