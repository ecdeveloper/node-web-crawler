socket.on('general-stats', function (data)
{
	var host = data.host.replace(/\./g,""),
		general_stats = 'mem: '+ data.memory +' / Reqs: '+ data.requests;

	// data.max_threads

	data.row_id = host;

	if (!$("#scraper-" + host).length)
		$("#active-scrapers-body").append(data.html)
		// $("#active-scrapers-body").append(
		// 	'<tr id="scraper-'+host+'"><td><a href="#">'+ data.host +'</a></td>'+
		// 	'<td>scraping</td> <td class="general-stats">'+ general_stats +'</td>'+
		// 	'<td> <button class="btn btn-primary">Pause</button> <button class="btn btn-danger">Stop</button></td>'+
		// 	'</tr>'
		// 	)
	else
		$("#scraper-" + host + " .general-stats").html(general_stats);
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