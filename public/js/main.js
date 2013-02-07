$(document).ready(function()
{
	$(document).on("click", ".pause-crawling", pauseCrawling);

	socket.on('general-stats', function (data)
	{
		var row_id = data.host.replace(/\./g,""),
			general_stats = 'mem: '+ data.memory +' / Reqs: '+ data.requests;

		data.row_id = row_id;

		if (!$("#scraper-" + row_id).length)
			$("#active-scrapers-body").append(data.html)
		else
			$("#scraper-" + row_id + " .general-stats").html(general_stats);
	});

	socket.on('checking', function(data)
	{
		$("#checking-log").prepend("<a href='"+ data.url +"'>" + data.url + "</a>" + "<br/>");
	});

	socket.on('rps', function(data)
	{
		rpsChart.series[0].addPoint([(new Date()).getTime(), parseInt(data.rps)], true, true)
	})

	socket.on('got-404', function(data)
	{
		$("#404").prepend(data.url + " [<a href='' target='_blank'>"+data.source+"</a>] <hr>");
	});
})


function pauseCrawling()
{
	socket.emit("pause-crawling", {host_id: $(this).data("host_id")})
}