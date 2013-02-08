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
	res.render('index');
}

function postAddScraper(req, res)
{
	var url   		   = req.body.url,
		depth 		   = parseInt(req.body.create_crawler_depth),
		create_sitemap = req.body.create_crawler_sitemap == 1,
		clean 		   = req.body.clean_crawl == 1;

	var child = child_process.fork("crawling-daemon.js");
	
	child.send(
		{
			action: "start",
			url: url,
			clean: clean
		});

	child.on("message", function(data)
	{
		switch (data.message)
		{
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

			case "done-crawling":
				if (create_sitemap)
					child.send({ action: "createSitemap" });

				io.sockets.emit('done-crawling', data);
				break;

			case "sitemap-created":

				var sitemap_path = "public/sitemaps/sitemap_"+ data.host +".xml";
				fs.writeFile(sitemap_path, data.content, function(err) {
				    if(err) {
				        console.log(err);
				    } else {
				        io.sockets.emit('sitemap-ready', {path: sitemap_path.replace("public/", "")})
				    }
				}); 

				break;
		}
	})

	child_processes[url] = child;
	res.redirect("/");
}