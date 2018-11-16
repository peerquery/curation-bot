'use strict';

const mdb = require('../config/connection');
const config = require('../config/config');

module.exports = async function(global_settings, custom_report) {
    var mclient = await mdb();

    var actions = 'vote_comment';

    //fetch team accounts including *project blog* but excluding *curators* and those *inactive*

    var projected_fields = {
        curation_rate: 1,
        curation_curator: 1,
        curation_remarks: 1,
        author: 1,
        permlink: 1,
    };

    var results;

    if (!custom_report) {
        results = await mclient
            .db()
            .collection('reportschemas')
            .findOneAndUpdate(
                { curation_state: 2 },
                { $inc: { curation_state: 1 } },
                { projection: projected_fields }
            ); // increase curation state at once, so this post will not be fetched twice
        // by the server's other versions in clusters or other EC2 instances
        // the danger here is that if the voting bot fails, well the post will remain marked as voted

        results = results.value;
    } else {
        results = custom_report;
    }

    if (!results || results == '') return false;

    var data = {};
    var approved =
        '<b>Approved for ' +
        results.curation_rate +
        '% by @' +
        results.curation_curator +
        '</b><br/><br/>';

    //set universal variables
    data.author = results.author;
    data.voter = global_settings.curation_bot_account;
    data.user = global_settings.curation_bot_account;
    data.permlink = results.permlink;
    data.weight = results.curation_rate * 100;
    data.body =
        approved +
        '<b>Remarks</b>: <em>' +
        results.curation_remarks +
        '</em><br/><br/>' +
        global_settings.curation_common_comment;
    data.json_metadata =
        '{"app": "' +
        config.site_name +
        '", "community":"' +
        config.community +
        '"}';
    data.parent_author = results.author;
    data.parent_permlink = results.permlink;
    data.new_permlink = Math.random()
        .toString(36)
        .substring(2);

    return {
        data: data,
        actions: actions,
        type: 'curation',
        config: global_settings,
    };
};
