'use strict';

var _ = require('lodash');

import { db } from '../services/db';
var utils = require('../../lib/utils');

var cacheName = 'COUNTRIES';

/**
* Query distinct countries. Implements all protocols supported by /countries endpoint
*
* @param {Object} query - Payload contains query paramters and their values
* @param {recordsCallback} cb - The callback that returns the records
*/
module.exports.query = function (query, redis, checkCache, cb) {
  // Save payload to use for caching
  var oPayload = _.cloneDeep(query);

  var sendResults = function (err, data) {
    cb(err, data, data.length);
  };

  var queryDatabase = function () {
    // Turn the payload into something we can use with psql
    let { payload, operators, betweens, nulls, notNulls } = utils.queryFromParameters(query);

    let resultsQuery = db
                        .from('measurements')
                        .select('country')
                        .count('value')
                        .groupBy('country');

    // Build on base query
    resultsQuery = utils.buildSQLQuery(resultsQuery, payload, operators, betweens, nulls, notNulls);

    // Grab the results
    resultsQuery.then((results) => {
      // Convert numbers to Numbers
      results.map((r) => {
        r.count = Number(r.count);
        r.code = r.country;
        r.name = utils.prettyCountryName(r.code);
        delete r.country;

        return r;
      });

      // Send result to client
      sendResults(null, results);

      // Save the data to cache
      redis.set(utils.payloadToKey(cacheName, oPayload), JSON.stringify(results));
    })
    .catch((err) => {
      sendResults(err);
    });
  };

  // Send back cached result if we have it and it matches our cached search
  if (checkCache && redis.ready) {
    redis.get(utils.payloadToKey(cacheName, oPayload), function (err, reply) {
      if (err) {
        console.error(err);
      } else if (reply) {
        try {
          var data = JSON.parse(reply);
          return sendResults(null, data);
        } catch (e) {
          console.error(e);
        }
      }

      // If we're here, try a database query since Redis failed us
      queryDatabase();
    });
  } else {
    // Query database if we have no Redis connection
    queryDatabase();
  }
};