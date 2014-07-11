$(document).ready(function() {
	var charts = {};

	$(document).on('click', '#toggle-create-crawler-options', toggleNewCrawlerOptions);
	$(document).on('click', '.pause-crawling', pauseCrawling);
	$(document).on('click', '.stop-crawling', stopCrawling);
	$(document).on('click', '.recrawl', reCrawl);

	socket.on('general-stats', function (data) {
		var row_id = data.host.replace(/\./g, '');

		data.row_id = row_id;

		if (!$('#scraper-' + row_id).length) {
			$('#active-scrapers-body').append(data.html)
			charts[row_id] = renderMemUsageChart('memusage-chart-' + row_id);
		}
		else {
			charts[row_id].series[0].addPoint(parseInt(data.memory), true);
			$('#general-stats-' + row_id).html('Processed: ' + data.grabbed + ' pages<br>Requests: ' + data.requests);
		}
	});

	socket.on('checking', function (data) {
		$('#checking-log').prepend('<a href="'+ data.url +'">' + data.url + '</a><br>');
	});

	socket.on('rps', function (data) {
		rpsChart.series[0].addPoint([(new Date()).getTime(), parseInt(data.rps)], true, true)
	});

	socket.on('got-404', function (data) {
		// $("#404").prepend(data.url + " [<a href='' target='_blank'>"+data.source+"</a>] <hr>");

		// @TODO: Log 404.
	});

	socket.on('error', function (data) {
		// var row_id = data.host.replace(/\./g,"");
		// $("#scraper-" + row_id + " .crawling-status").html('<span class="label label-important">error</span>')

		// @TODO: Log the error. An error usually happens on a particular url. It doesn't stop the whole crawling.
	});

	socket.on('bad-content-encoding', function (data) {
		console.log('Unsupported content encoding');

		// @TODO: Log the error.
	});

	socket.on('auth-required', function (data) {
		var row_id = data.host.replace(/\./g,"");

		if (!$('#scraper-' + row_id).length) {
			$('#active-scrapers-body').append(data.html)
		}
		
		$('#scraper-' + row_id + ' .crawling-status').html('<span class="label label-important">bad auth</span>');
	});

	socket.on('done-crawling', function (data) {
		var row_id = data.host.replace(/\./g,"");
		$('#scraper-' + row_id + ' .crawling-status').html('<span class="label label-success">done</span>')
		$('#general-stats-' + row_id).html('Processed: ' + data.processed + ' pages');

		$('.pause-crawling[data-host_id="'+ row_id +'"]').hide();
		$('.stop-crawling[data-host_id="'+ row_id +'"]').hide();
		$('.recrawl[data-host_id="'+ row_id +'"]').show();
	});

	socket.on('stop-crawling', function (data) {
		var row_id = data.host.replace(/\./g,"");
		$('#scraper-' + row_id + ' .crawling-status').html('<span class="label label-important">stopped</span>')
		$('#scraper-' + row_id + ' .general-stats').empty();
	});

	socket.on('sitemap-ready', function (data) {
		var row_id = data.host.replace(/\./g, '');
		$('#sitemap-download-' + row_id).html('<hr><a href="/'+ data.path +'">Download sitemap</a>');
	});
})


function pauseCrawling () {
	socket.emit('pause-crawling', { host_id: $(this).data('host_id') });
}

function stopCrawling () {
	socket.emit('stop-crawling', { host_id: $(this).data('host_id') });
}

function reCrawl () {
	socket.emit('recrawl', { host_id: $(this).data('host_id') });
}

function toggleNewCrawlerOptions () {
	var toggler = $(this);
	 $('#create-crawler-options').slideToggle(function () {
	 	toggler.removeClass('collapsed expanded').addClass( ($(this).is(':visible')) ? 'expanded' : 'collapsed' );
	 });
}