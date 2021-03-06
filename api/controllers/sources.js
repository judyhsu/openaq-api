'use strict';

import { db } from '../services/db';
var utils = require('../../lib/utils');

/**
* Query Sources. Implements all protocols supported by /sources endpoint
*
* @param {Object} query - Payload contains query paramters and their values
* @param {integer} page - Page number
* @param {integer} limit - Items per page
* @param {recordsCallback} cb - The callback that returns the records
*/
module.exports.query = function (query, page, limit, cb) {
  // Turn the payload into something we can use with psql
  let { payload, operators, betweens, nulls, notNulls } = utils.queryFromParameters(query);

  //
  // Apply paging
  //
  var skip = limit * (page - 1);

  //
  // Run the queries, first do a count for paging, then get results
  //
  let countQuery = db
                    .count('id')
                    .from('sources');
  countQuery = utils.buildSQLQuery(countQuery, payload, operators, betweens, nulls, notNulls);
  countQuery.then((count) => {
    return Number(count[0].count); // PostgreSQL returns count as string
  })
  .then((count) => {
    // Base query
    let resultsQuery = db
                        .select('data')
                        .from('sources')
                        .limit(limit).offset(skip);
    // Build on base query
    resultsQuery = utils.buildSQLQuery(resultsQuery, payload, operators, betweens, nulls, notNulls);

    // Run the query
    resultsQuery.then((results) => {
      results = results.map((r) => {
        return r.data;
      });
      return cb(null, results, count);
    })
      .catch((err) => {
        return cb(err);
      });
  })
  .catch((err) => {
    return cb(err);
  });
};
