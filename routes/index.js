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
	var port = res.app.settings.config.port;

	res.render('index', {
		port: port
	});
}

function postAddScraper(req, res)
{
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
	
	if (auth_user!="" && auth_pass!="")
		child.send(
		{
			action: "setAuth",
			auth_user: auth_user,
			auth_pass: auth_pass
		})

	child.send(
		{
			action: "start",
			url: url,
			clean: clean,
			depth: depth
		});

	child.on("message", function(data)
	{
		switch (data.message)
		{
			case "auth-required":
				data.row_id = data.host.replace(/\./g,"");
				res.render("partials/scraper-stats-row", {data: data, layout: false}, function(err, html)
				{
					if (err != null)
						return;

					data.html = html;
					io.sockets.emit('auth-required', data);
				});

				break;

			case "general-stats":
				data.row_id = data.host.replace(/\./g,"");
				res.render("partials/scraper-stats-row", {data: data, layout: false}, function(err, html)
				{
					if (err != null)
						return;

					data.html = html;

					res.render("partials/scraper-general-stats-cell", {data: data, layout: false}, function(err, html)
					{
						if (err != null)
							return;

						data.stats_html = html;
						io.sockets.emit('general-stats', data);
					})
				});
				break;

			case "error":
				io.sockets.emit('error', data);				
				break;

			case "done-crawling": case "stop-crawling": 
				if (create_sitemap)
					child.send({ action: "createSitemap" });
				else
					child.kill(); // Terminate crawling daemon

				io.sockets.emit(data.message, data); // done-crawling | stop-crawling
				break;


			case "sitemap-created":

				var sitemap_path = "public/sitemaps/sitemap_"+ data.host +".xml";
				fs.writeFile(sitemap_path, data.content, function(err)
				{
				    if(err)
				        console.log(err);
				   	else
				        io.sockets.emit('sitemap-ready', {path: sitemap_path.replace("public/", "")})

				    // Terminate crawling daemon
					child.kill();
				}); 

				break;
		}
	})

	// child_processes[url] = child;
	res.redirect("/");
}
