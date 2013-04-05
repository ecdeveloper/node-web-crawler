$(document).ready(function()
{
	$(document).on("click", "#toggle-create-crawler-options", toggleNewCrawlerOptions);
	$(document).on("click", ".pause-crawling", pauseCrawling);
	$(document).on("click", ".stop-crawling", stopCrawling);

	socket.on('general-stats', function (data)
	{
		var row_id = data.host.replace(/\./g,"");

		data.row_id = row_id;

		if (!$("#scraper-" + row_id).length)
			$("#active-scrapers-body").append(data.html)
		else
			$("#scraper-" + row_id + " .general-stats").html(data.stats_html);
	})

	socket.on('checking', function(data)
	{
		$("#checking-log").prepend("<a href='"+ data.url +"'>" + data.url + "</a>" + "<br/>");
	})

	socket.on('rps', function(data)
	{
		rpsChart.series[0].addPoint([(new Date()).getTime(), parseInt(data.rps)], true, true)
	})

	socket.on('got-404', function(data)
	{
		// $("#404").prepend(data.url + " [<a href='' target='_blank'>"+data.source+"</a>] <hr>");
	})

	socket.on('error', function(data)
	{
		var row_id = data.host.replace(/\./g,"");
		$("#scraper-" + row_id + " .crawling-status").html('<span class="label label-success">error</span>')		
	})

	socket.on('auth-required', function(data)
	{
		var row_id = data.host.replace(/\./g,"");

		if (!$("#scraper-" + row_id).length)
			$("#active-scrapers-body").append(data.html)
		
		$("#scraper-" + row_id + " .crawling-status").html('<span class="label label-important">bad auth</span>')		
	})

	socket.on('done-crawling', function(data)
	{
		var row_id = data.host.replace(/\./g,"");
		$("#scraper-" + row_id + " .crawling-status").html('<span class="label label-success">done</span>')
		$("#scraper-" + row_id + " .general-stats").html('');
	})

	socket.on('stop-crawling', function(data)
	{
		var row_id = data.host.replace(/\./g,"");
		$("#scraper-" + row_id + " .crawling-status").html('<span class="label label-important">stopped</span>')
		$("#scraper-" + row_id + " .general-stats").html('');
	})

	socket.on('sitemap-ready', function(data)
	{
		$("body").append("<a href='/"+ data.path +"'>Download sitemap</a>");
	})
})


function pauseCrawling() {
	socket.emit("pause-crawling", {host_id: $(this).data("host_id")})
}

function stopCrawling() {
	socket.emit("stop-crawling", {host_id: $(this).data("host_id")})
}

function toggleNewCrawlerOptions() {
	var toggler = $(this);
	 $('#create-crawler-options').slideToggle(function(){
	 	toggler.removeClass("collapsed expanded").addClass( ($(this).is(":visible")) ? "expanded" : "collapsed" );
	 });
}