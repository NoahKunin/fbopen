var util = require('util');
var datasource_id = 'FBO';
var fs = require('fs');
var moment = require('moment');
//var jsonsp = require('jsonsp');
var S = require('string');
var transfuse = require('transfuse');

var field_map = {
	'DATE': 'posted_dt'
	, 'SUBJECT': 'title'
	, 'AGENCY': 'agency'
	, 'OFFICE': 'office'
	, 'LOCATION': 'location'
	, 'ZIP': 'zipcode'
	, 'SOLNBR': 'solnbr'
	, 'RESPDATE': 'close_dt'
	, 'DESC': 'description'
	, 'URL': 'listing_url'
}

var tr = transfuse(function(foo) {
    parent_notice = foo[0];
    for (notice_type in parent_notice) {
        // util.log('notice type: ' + notice_type);
        notice = parent_notice[notice_type]
        if (notice_type == 'PRESOL' || notice_type == 'COMBINE') {
            notice_out = {};
            notice_out.data_type = 'opp';
            notice_out.data_source = datasource_id;
            notice_out.notice_type = notice_type;

            notice_out.solnbr = clean_solnbr(notice.SOLNBR);
            notice_out.id = datasource_id + ':' + notice_type + ':' + notice_out.solnbr;

            var mapped_field;
            //util.log(util.inspect(notice));

            for (field in notice) {
                //util.log("field: " + field);

                // skip solnbr, already handled above
                if (field == 'SOLNBR') continue;

                // skip YEAR because it gets combined with DATE instead (smh)
                if (field == 'YEAR') continue;

                // 'DESC2' is always "Link to Document"
                if (field == 'DESC2') continue;

                // skip empty fields
                if (notice[field] == '') continue;

                // get the proper field name: 
                // some are mapped to core FBOpen Solr fields, 
                // others simply prefixed "FBO_", 
                // and non-core date fields get "_dt" added.

                // simple_log('field = ' + field);

                mapped_field = field_map[field];
                if (mapped_field) {
                    field_out = mapped_field;
                } else {
                    field_out = datasource_id + '_' + field; // prefix non-standard fields
                    if (S(field_out).endsWith('DATE')) field_out += '_dt'; // make date fields date-friendly in Solr
                }

                // exceptions
                if (field in ['EMAIL', 'EMAIL2']) {
                    field_out = 'FBO_EMAIL_ADDRESS';
                }
                if (field == 'DESC3') { // email description always goes here (smh)
                    field_out = 'FBO_EMAIL_DESC';
                }

                val_in = notice[field];
                if (field == 'DATE') {
                    val_in = val_in + notice.YEAR;
                }

                // fix up data fields
                val_out = clean_field_value(field, val_in);

                // add to the notice JSON
                notice_out[field_out] = val_out;
            }
            
            // TEST
            //util.log('notice_out = ' + JSON.stringify(notice_out, null, "  "));
            //util.log(util.inspect(notice_out));

            return notice_out;
        }

        return 'baz';
    }
});

var stream = fs.createReadStream('notices.json');
stream.pipe(tr).pipe;
tr.pipe(process.stdout);
process.stdin.resume();

function clean_solnbr(solnbr) {
	return S(solnbr).trim().slugify().s;
}

function solrize_date(fbo_date) {
	// fbo_date is MMDDYYYY or MMDDYY
	// Solr date is yyyy-MM-dd'T'HH:mm:sss'Z
	var dt = moment(fbo_date, ['MMDDYY', 'MMDDYYYY']);

	if (dt.isValid()) {
		
		// simple_log('fbo_date = ' + fbo_date + ', dt = ' + dt.format('YYYY-MM-DD'));

		dt_out = dt.format('YYYY-MM-DD[T]HH:mm:ss[Z]');
		return dt_out;
	} else {
		simple_log('WARNING: momentjs could not convert [' + fbo_date + '] into a valid date.', true);
		return false;
	}

} // solrize_date()

function clean_field_value(field, val) {

	// get field value, and:
	// remove "<![CDATA[" and "]]>" if necessary
	// replace <p> and <br> tags with newlines
	// remove HTML entity codes ("&xyz;") [note: is there a better function?]

	// unescape entity codes; strip out all other HTML
	var field_value = S(val).escapeHTML().stripTags().s;

	if (field_value == '') return '';

	// make dates Solr-friendly
	// if (tag == 'DATE' || tag == 'RESPDATE' || tag == 'ARCHDATE' || tag == 'AWDDATE') {
	if (S(field).endsWith('DATE') || S(field).endsWith('_dt')) {
		// simple_log('e_name = ' + e_name + ', pre-solrized date = [' + field_value + ']');
		field_value = solrize_date(field_value);
		// simple_log('solrized = [' + field_value + ']');
	}

	return field_value;	
}


// var util = require('util');
// 
// console.log('Starting');
// 
// // Intialize a new JSON stream parser.
// //   Listen for the 'object' event, which is emitted whenever a complete JSON
// //   object is parsed from the stream.  In this example, each object is a tweet
// //   from the Twitter Streaming API.
// 
// var parser = new jsonsp.Parser()
// parser.on('object', function(notice) {
//     util.log(util.inspect(notice));
// });
// 
// 
// var stream = fs.createReadStream('notices.json').addListener('data', function(chunk) {
//   // Feed each chunk of data incrementally to the JSON stream parser.  For each
//   // complete JSON object parsed, an 'object' event will be emitted.
//     parser.parse(chunk.toString('utf8'));
// });
// //stream.end();