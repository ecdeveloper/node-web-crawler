/*
 * Routes handlers
 */

var exec = require('child_process').exec,
	child_process = require('child_process'),
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
	var url   = req.body.url;
	var child = child_process.fork("scraping-daemon.js", ["-url=" + url]);
	
	child.send(
		{
			action: "start",
			url: url,
			clean: false
		});

	child.on("message", function(data)
	{
		switch (data.message)
		{
			case "general-stats":
				io.sockets.emit('general-stats', data);
				break;
		}
	})

	child_processes[url] = child;
	res.redirect("/");
}