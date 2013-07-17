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

/*
	requestsRunningPool: array of links are requesting now
*/

var scrapeHost = "", max_depth, create_sitemap, link, auth = {},
	LinksCheckModel, LinksGrabbedModel,
	requestsRunning = 0, requestsRunningPool = [], requestsPerSecond = 0, maxThreads = 5,
	checkUrlInterval = null, processingDOM = false;

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
			max_depth 	   = data.depth;
			create_sitemap = data.create_sitemap;

			scrapeHost = url.parse(data.url).host;

			LinksCheckModel   = mongoose.model("links_check_" + scrapeHost, new mongoose.Schema({ url: { type: String, index: { unique: true } }, source: String, from_redirect: {type: Boolean, default: false}, depth_level: Number }));
			LinksGrabbedModel = mongoose.model("links_grabbed_" + scrapeHost, new mongoose.Schema({url: { type: String, index: { unique: true }}, source: String, content_type: String, http_status: Number, depth_level: Number }));

			if (data.clean) {
				LinksCheckModel.find().remove();
				LinksGrabbedModel.find().remove();
			}

			// Add first url to `toCheckModel`
			(new LinksCheckModel({url: data.url, depth_level: 0})).save(function(err, doc)
				{
					console.log("First link in queue: [err/doc]", err, doc);
					util.log("Start crawling "+ scrapeHost +"...");

					sendGeneralStats();
					setInterval(sendGeneralStats, 3000);
					checkUrlInterval = setInterval(checkUrl, 10);
				});

			break;

		case "createSitemap":
			LinksGrabbedModel.find({http_status: 200, content_type: new RegExp("^text/html;(.*)$")}).lean().exec(function (err, docs) {

				var sitemap_content = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

				docs.forEach(function(doc)
				{
					sitemap_content += 
					'<url>' +
      					'<loc>'+ doc.url +'</loc>' +
      					// '<lastmod>---</lastmod>' +
      					// '<changefreq>---</changefreq>' +
      					'<priority>0.7</priority>' +
   					'</url>';
				})

				sitemap_content += '</urlset>';
				process.send({ message: 'sitemap-created', content: sitemap_content, host: scrapeHost })
			})
			break;
	}
});


function sendGeneralStats()
{
	// console.log("Send General Stats");
	LinksGrabbedModel.count({}, function(err, countGrabbed)
	{
		LinksCheckModel.count({}, function(err, countCheck)
		{
			process.send(
			{
				message: 'general-stats',
				memory: bytesToSize(process.memoryUsage().rss),
				requests: requestsRunning,
				grabbed: countGrabbed,
				tocheck: countCheck,
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
		{
			if (!processingDOM && requestsRunning == 0) {
				console.log("Done crawling");
				clearInterval(checkUrlInterval);
				process.send({ message: 'done-crawling', host: scrapeHost })
			}

			return;
		}

		var source_link = doc.source,
			depth_level = doc.depth_level;

		link = doc.url;

		if( requestsRunning > maxThreads )
			return;

		// console.log(link, " removing...");
		doc.remove(function()
		{
			if ( requestsRunningPool.indexOf(link) > -1 ) {
				// console.log("Duplicated link request", link);
				return;
			}

			// console.log(link, " removed");
			// Keep processing once the link was removed from queue

			// Save the link to GrabbedModel before starting request. Update the doc (content-type, status, etc) once request is done
			LinksGrabbedModel.count({url: link}, function(err, count)
			{
				if( count == 0 ) {
					(new LinksGrabbedModel({url: link, source: source_link, depth_level: depth_level})).save();
				}
			});

			var urlObj = url.parse(link);
			console.log("Starting request...", link);
			requestsRunning++;
			requestsRunningPool.push(link);

			process.send({message: "checking", url: urlObj.protocol+"//"+urlObj.host+urlObj.path})

			make_request(urlObj.protocol, urlObj.host, urlObj.path, depth_level, function(err, statusCode, body, reqUrl, reqUrlDepth, headers)
			{
				console.log(statusCode);
				
				processingDOM = true;
				requestsPerSecond++;
				requestsRunning--;
				requestsRunningPool.splice( requestsRunningPool.indexOf(reqUrl), 1 )

				if (err || statusCode == 500) {
					processingDOM = false;
					process.send({message: "error", host: scrapeHost, url: reqUrl, source: doc.source})
					return;
				}

				if (statusCode == 401) {
					console.log("Send Auth Required");
					process.send({message: "auth-required", host: scrapeHost, url: reqUrl, source: doc.source})
					processingDOM = false;
					return;
				}


				LinksGrabbedModel.findOne({url: reqUrl}, function(err, doc)
				{
					if (doc==null) {
						return;
					}

					if (statusCode == 404)
						process.send({message: "got-404", url: reqUrl, source: doc.source})

					doc.http_status = statusCode;
					doc.content_type = headers['content-type'];
					doc.save();
				})

				// Just skip checking body of images, documents, ... (e.g. application/pdf, image/png, etc)
				if (typeof headers['content-type']!="undefined" && headers['content-type'].indexOf("text/html") != 0) {
					processingDOM = false;
					return;
				}

				if ( [301,302,303].indexOf(statusCode) > -1 ) {
					var redir_location = url.parse(headers.location);
					if (redir_location.host == undefined) {
						redir_location.host = url.parse(reqUrl).host;
					}

					if (redir_location.host == scrapeHost)
						(new LinksCheckModel({url:redir_location.href, source: reqUrl, depth_level: reqUrlDepth, from_redirect: true})).save();
					
					processingDOM = false;
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

							processingDOM = false;
							return;
						}

						var $ = window.$;
						var links_found = $("a").length;
						
						$("a").each(function()
						{
							var lnk = $(this).attr("href").replace(new RegExp("#(.*)"), "");

							if ((lnk = check_link(lnk)) == false) {
								processingDOM = (--links_found > 0);
								return;
							}

							(function(add_link, source_link, source_depth) {
						
								// If max_depth is set and current link's depth is greater - skip it
								if ( max_depth > 0 && parseInt(source_depth+1) > max_depth ) {
									processingDOM = (--links_found > 0);
									return;
								}

								// Check first if the link wasn't grabbed yet
								LinksGrabbedModel.findOne({url: add_link}, function(err, doc)
								{
									if( doc==null || doc.length==0 ) {
										// Check if link is not in queue already
										LinksCheckModel.findOne({url: add_link}, function(err, doc)
										{
											var link_depth = parseInt(source_depth+1);

											if( doc==null || doc.length==0) {
												(new LinksCheckModel({url:add_link, source: source_link, depth_level: link_depth})).save(function(){ processingDOM = (--links_found > 0); });
											}
											else
												processingDOM = (--links_found > 0);
										});
									}
									else
										processingDOM = (--links_found > 0);
								});
							})(lnk, reqUrl, reqUrlDepth);
						});

						window.close();
					}
				});
			});

			urlObj = null;
		});
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

function make_request(protocol, host, path, depth, callback)
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

// console.log("STATUS CODE: ", res.headers.location);

		if (res.statusCode == 401)
			callback(false, res.statusCode, null, (protocol+"//"+host+path), depth, res.headers);

		res.setEncoding('utf8');
		res.on('data', function (chunk) {
			if (res.statusCode == 200)
				data += chunk;
		});

		res.on('end', function() {
			callback(false, res.statusCode, data, (protocol+"//"+host+path), depth, res.headers);
		});
	});

	req.on('error', function(err) {
		console.log("ERR: %s", err, opts);
		callback(true, null, null, (protocol+"//"+host+path), depth, null);
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
