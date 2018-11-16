'use strict';

var mdb = require('../config/connection');
const global_config = require('../helpers/globals');

const voter_bot = require('../bot/voter-bot');
const curation_voter = require('../bot/curation-voter');
const curator_voter = require('../bot/curator-voter');
const team_project_voter = require('../bot/team-project-voter');
const today = require('../helpers/day');

module.exports = async function(app) {
    var mclient = await mdb();

    var curation_voter_timer;

    //main timer which only runs every 24 hours and calls or shuts(on bot rest day) all other timers

    //no need make this dynamically updatable, since its used once a day, reset every day by the setInterval within which it dwells
    //also, for where its needed dynamically(curation_voter_timer), it is called lively as *await global_config()* not as *config*
    var config = await global_config();

    if (
        today().toLowerCase() == config.curation_rest_day1 ||
        today().toLowerCase() == config.curation_rest_day2
    ) {
        clearInterval(curation_voter_timer);
    } else {
        try {
            //before everything else, check if all curation is voted

            var curations_hanging = await mclient
                .db()
                .collection('reportschemas')
                .find({ curated_state: 3, voted: { $exists: false } })
                .toArray();
            if (!curations_hanging) {
                for (let x in curations_hanging) {
                    var missed_curation_data = await curation_voter(
                        await global_config(),
                        curations_hanging[x]
                    );
                    if (missed_curation_data) voter_bot(missed_curation_data);
                }
            }

            //before everything else, check if all curators, team and project are voted

            var curators_paid = await mclient
                .db()
                .collection('activityschemas')
                .findOne({
                    indentifier: new Date().toDateString() + 'curators_voted',
                });
            if (!curators_paid) run_curator_voter();

            var team_paid = await mclient
                .db()
                .collection('activityschemas')
                .findOne({
                    indentifier: new Date().toDateString() + 'team_voted',
                });
            if (!team_paid) run_team_project_voter();

            //if not rest day, then set timer for curation
            var curation_interval =
                config.curation_vote_interval_minutes * 60 * 1000;
            //console.log(curation_interval)

            curation_voter_timer = setInterval(async function() {
                var curation_data = await curation_voter(await global_config());

                if (curation_data) voter_bot(curation_data);
            }, curation_interval);

            //see if details exists, else set them. set the fact that the team are bing paid for today

            var newActivity = {
                title:
                    'Project and team members compensated for today from: ' +
                    new Date(),
                indentifier: new Date().toDateString() + '_team_project_voting',
                action: 'pay',
                type: 'vote',
                source: 'bot',
                account: config.curation_bot_account,
                description: 'Project and team members compensated for today!',
                created: new Date(),
            };

            var results = await mclient
                .db()
                .collection('activityschemas')
                .findOneAndUpdate(
                    {
                        indentifier:
                            new Date().toDateString() + '_team_project_voted',
                    },
                    { $setOnInsert: newActivity },
                    { upsert: true }
                );

            results = results.value;

            if (!results) {
                //this is critically important. it will ensure that when in cluster mode or running
                //multiple instances, no two server spawns will run this code twice
                //hence no duplicate voting of project and team

                //these are not timers, just functions that run every 24 hours

                run_curator_voter();
                run_team_project_voter();
            }
        } catch (err) {
            console.log(err);
        }
    }

    async function run_curator_voter() {
        //curators data
        var curator_data = await curator_voter(config);

        if (curator_data)
            for (let x in curator_data) {
                voter_bot(curator_data[x]);

                if (x == curator_data.length - 1) {
                    await mclient
                        .db()
                        .collection('activityschemas')
                        .insertOne({
                            indentifier:
                                new Date().toDateString() + 'curators_voted',
                        });
                }
            }
    }

    async function run_team_project_voter() {
        //team and project data
        var team_project_data = await team_project_voter(config);

        if (team_project_data)
            for (let x in team_project_data) {
                voter_bot(team_project_data[x]);

                if (x == team_project_data.length - 1) {
                    await mclient
                        .db()
                        .collection('activityschemas')
                        .insertOne({
                            indentifier:
                                new Date().toDateString() + 'team_voted',
                        });
                }
            }
    }

    console.log('\n\n\n    > voting bot activated!');
};
