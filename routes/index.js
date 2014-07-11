/*
 * Routes handlers
 */

var exec = require('child_process').exec,
	child_process = require('child_process'),
	fs 			  = require('fs'),
	child_processes = [];

module.exports = function(app) {
	app.get("/", getHomePage);
	app.post("/add", postAddScraper);
}

function getHomePage(req, res) {
	var port = res.app.settings.config.server.port;

	res.render('index', {
		port: port
	});
}

function postAddScraper(req, res) {
	var url   		   = req.body.url,
		auth_user	   = req.body.auth_user,
		auth_pass	   = req.body.auth_pass,
		depth 		   = parseInt(req.body.create_crawler_depth),
		create_sitemap = req.body.create_crawler_sitemap == 1,
		clean 		   = req.body.clean_crawl == 1,
		config         = res.app.settings.config;

	var child = child_process.fork("crawling-daemon.js");

	// setup config
	child.send({
		action: "setConfig",
		config: config
	});
	
	if (auth_user!="" && auth_pass!="") {
		child.send({
			action: "setAuth",
			auth_user: auth_user,
			auth_pass: auth_pass
		});
	}

	child.send({
		action: "start",
		url: url,
		clean: clean,
		depth: depth
	});

	child.on("message", function(data) {
		switch (data.message) {
			case "auth-required":
				data.row_id = data.host.replace(/\./g,"");
				res.render("partials/scraper-stats-row", {data: data, layout: false}, function(err, html) {
					if (err != null) {
						return;
					}

					data.html = html;
					io.sockets.emit('auth-required', data);
				});

				break;

			case "general-stats":
				data.row_id = data.host.replace(/\./g,"");

				res.render("partials/scraper-stats-row", {data: data, layout: false}, function(err, html) {
					if (err != null) {
						return;
					}

					data.html = html;
					io.sockets.emit('general-stats', data);
				});

				break;

			case "done-crawling": case "stop-crawling": 
				if (create_sitemap) {
					child.send({ action: "createSitemap" });
				} else {
					child.kill(); // Terminate crawling daemon
				}

				io.sockets.emit(data.message, data); // done-crawling | stop-crawling
				break;

			// @TODO: Implement
			case "recrawl":
				break;


			case "sitemap-created":
				var sitemap_path = "public/sitemaps/";
				fs.exists(sitemap_path, function(exists) {
					if (!exists) {
						fs.mkdir(sitemap_path, writeSitemap);
					} else {
						writeSitemap();
					}

					// Terminate crawling daemon
					child.kill();
				});

				function writeSitemap() {
					sitemap_path += "sitemap_"+ data.host +".xml";
					fs.writeFile(sitemap_path, data.content, function(err) {
					    if(err) {
					        console.log(err);
					    }
					   	else {
					        io.sockets.emit('sitemap-ready', { host: data.host, path: sitemap_path.replace("public/", "") })
					   	}
					});
				}
				break;

			default:
				io.sockets.emit(data.message, data);
				break;
		}
	})

	res.redirect("/");
}
