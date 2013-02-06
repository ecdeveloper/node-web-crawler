/*
	Scraper app. Only runs as child forked process.
*/

var	util 	= require('util'),
	http 	= require('http'),
	url 	= require('url'),
	mongoose= require('mongoose'),
	argv 	= require('named-argv'),
	jsdom	= require('jsdom');

mongoose.connect('mongodb://localhost/search_for_404_v4');

var scrapeHost = "", fullUrl = "", link, auth = {},
	Links404Model, LinksCheckModel, LinksGrabbedModel,
	requestsRunning = 0, requestsPerSecond = 0, maxThreads = 20;

process.on("message", function(data)
{
	switch (data.action)
	{
		case "setAuth":
			auth.user = data.auth_user;
			auth.pass = data.auth_pass;
			break;

		case "setMaxThreads":
			maxThreads = data.max_threads;
			break;

		case "start":
			fullUrl    = data.url;
			scrapeHost = url.parse(data.url).host;

			Links404Model 	  = mongoose.model("links_404_" + scrapeHost, new mongoose.Schema({url:String, source:String}));
			LinksCheckModel   = mongoose.model("links_check_" + scrapeHost, new mongoose.Schema({ url: { type: String, index: { unique: true } }, source: String, from_redirect: {type: Boolean, default: false} }));
			LinksGrabbedModel = mongoose.model("links_grabbed_" + scrapeHost, new mongoose.Schema({url: { type: String, index: { unique: true }}, source: String }));

			if (data.clean) {
				Links404Model.find().remove();
				LinksCheckModel.find().remove();
				LinksGrabbedModel.find().remove();
			}

			(new LinksCheckModel({url: argv.opts.url})).save();
			util.log("Start scraping "+ scrapeHost +"...");

			setInterval(sendGeneralStats, 3000);
			setInterval(checkUrl, 10);
			break;
	}
});


function sendGeneralStats()
{
	LinksGrabbedModel.count({}, function(err, count_grabbed)
	{
		LinksCheckModel.count({}, function(err, count_check)
		{
			process.send(
			{
				message: 'general-stats',
				memory: bytesToSize(process.memoryUsage().rss),
				requests: requestsRunning,
				grabbed: count_grabbed,
				tocheck: count_check,
				max_threads: maxThreads,
				host: scrapeHost
			});
		});
	});
}


// setInterval(function()
// {
// 	io.sockets.emit("rps", {rps: requestsPerSecond});
// 	requestsPerSecond = 0;
// },
// 1000)

function checkUrl()
{
	LinksCheckModel.findOne({}, function(err, doc)
	{
		if( doc==null )
			return;

		if( requestsRunning > maxThreads )
			return;

		var source_link = doc.source;
		link = doc.url;
		doc.remove();

		LinksGrabbedModel.count({url: link}, function(err, count)
		{
			if( count == 0 ) {
				(new LinksGrabbedModel({url: link, source: source_link})).save();
			}
		});

		var urlObj = url.parse(link);
		requestsRunning++;

		process.send({message: "checking", url: urlObj.protocol+"//"+urlObj.host+urlObj.path})

		make_request(urlObj.protocol, urlObj.host, urlObj.path, function(statusCode, body, reqUrl, headers)
		{
			requestsPerSecond++;
			requestsRunning--;

			if( statusCode == 404 ) {
				LinksGrabbedModel.findOne({url: reqUrl}, function(err, doc) {
					if ( doc != null ) {
						(new Links404Model({url:reqUrl, source:doc.source})).save();
						process.send({message: "got-404", url: reqUrl, source: doc.source})
					}
				});

				return;
			}
			else if ( [301,302,303].indexOf(statusCode) > -1 ) {
				var redir_location = url.parse(headers.location);
				if (redir_location.host == undefined) {
					redir_location.host = url.parse(reqUrl).host;
				}

				(new LinksCheckModel({url:redir_location.href, source: reqUrl, from_redirect: true})).save();
				return;
			}

			jsdom.env({
				html: body,
				scripts: ["http://code.jquery.com/jquery.js"],
				done: function (errors, window)
				{
					if (window == undefined || window.$ == undefined) {
						if (window != undefined)
							window.close();
						return;
					}

					var $ = window.$;
					$("a").each(function()
					{
						var lnk = $(this).attr("href");

						if ((lnk = check_link(lnk)) == false)
							return;

						(function(add_link, source_link) {
							LinksGrabbedModel.findOne({url: add_link}, function(err, doc)
							{
								if( doc==null || doc.length==0 ) {
									LinksCheckModel.findOne({url: add_link}, function(err, doc)
									{
										if( doc==null || doc.length==0 ) {
											(new LinksCheckModel({url:add_link, source: source_link})).save();
										}
									});
								}
							});
						})(lnk, reqUrl);
					});

					window.close();
				}
			});
		});

		urlObj = null;
	});
};


function check_link(lnk)
{
	if( lnk.indexOf("/")==0 )
		lnk = "http://" + scrapeHost + lnk;

	if( lnk==undefined || ["#", ""].indexOf(lnk)!=-1 || (lnk.indexOf("http://" + scrapeHost)!=0 && lnk.indexOf("https://"+scrapeHost)!=0) ) {
		return false;
	}

	return lnk;
}

function make_request(protocol, host, path, callback)
{
	var opts = {
		host: host,
		port: 80,
		path: path,
		method: "GET"
	};

	if( Object.keys(auth).length )
		opts.auth = [auth.user, auth.pass].join(":");

	var req = http.request(opts, function(res)
	{
		var data = "";

		res.setEncoding('utf8');
		res.on('data', function (chunk) {
			if(res.statusCode==200)
				data += chunk;
		});

		res.on('end', function(){
			callback(res.statusCode, data, (protocol+"//"+host+path), res.headers);
		});
	});

	req.on('error', function(err) {
		console.log("ERR: %s", err, opts);
	});

	req.end();
}

function randomString(len)
{
	var vowels = ['a', 'e', 'i', 'o', 'u'];
	var consts =  ['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'qu', 'r', 's', 't', 'v', 'w', 'x', 'y', 'z', 'tt', 'ch', 'sh'];
	var word = '';

	var arr;
	var is_vowel = false;

	for (var i = 0; i < len; i++) {
	  if (is_vowel) arr = vowels
	  else arr = consts
	  is_vowel = !is_vowel;

	  word += arr[Math.round(Math.random()*(arr.length-1))];
	}

	return word;
}

function bytesToSize(bytes, precision)
{
    var kilobyte = 1024;
    var megabyte = kilobyte * 1024;
    var gigabyte = megabyte * 1024;
    var terabyte = gigabyte * 1024;

    if ((bytes >= 0) && (bytes < kilobyte)) {
        return bytes + ' B';

    } else if ((bytes >= kilobyte) && (bytes < megabyte)) {
        return (bytes / kilobyte).toFixed(precision) + ' KB';

    } else if ((bytes >= megabyte) && (bytes < gigabyte)) {
        return (bytes / megabyte).toFixed(precision) + ' MB';

    } else if ((bytes >= gigabyte) && (bytes < terabyte)) {
        return (bytes / gigabyte).toFixed(precision) + ' GB';

    } else if (bytes >= terabyte) {
        return (bytes / terabyte).toFixed(precision) + ' TB';

    } else {
        return bytes + ' B';
    }
}
