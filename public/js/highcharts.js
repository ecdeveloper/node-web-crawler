var memUsageChart = null,
	rpsChart 	  = null;

var renderMemUsageChart = function (elemId) {
	return new Highcharts.Chart({
		chart: {
			renderTo: elemId,
			type: 'spline',
			marginRight: 0
		},
		title: {
			text: ''
		},
		xAxis: {
			// type: 'datetime',
			// tickPixelInterval: 150
			labels: { enabled: false }
		},
		yAxis: {
			title: {
				text: 'Memory (mb)'
			},
			plotLines: [{
				value: 0,
				width: 1,
				color: '#808080'
			}]
		},
		legend: {
			enabled: false
		},
		exporting: {
			enabled: false
		},
		series: [{
			name: 'mem',
			data: (function() { return []; })()
		}],

		plotOptions: {
			spline: {
				marker: { enabled: false }
			}
		}
	});
};

var renderRpsChart = function (elemId) {
	return new Highcharts.Chart({
		chart: {
			renderTo: 'rps-chart',
			type: 'spline',
			marginRight: 10
		},
		title: {
			text: 'Requests per second'
		},
		xAxis: {
			type: 'datetime',
			tickPixelInterval: 150
		},
		yAxis: {
			title: {
				text: 'Requests'
			},
			plotLines: [{
				value: 0,
				width: 1,
				color: '#808080'
			}]
		},
		legend: {
			enabled: false
		},
		exporting: {
			enabled: false
		},
		series: [{
			name: 'Random data',
			data: (function() {
				var data = [],
					time = (new Date()).getTime(),
					i;

				for (i = -19; i <= 0; i++) {
					data.push({
						x: time + i * 1000,
						y: 0
					});
				}
				return data;
			})()
		}]
	});
};

$(function () {
	$(document).ready(function() {
		Highcharts.setOptions({
			global: {
				useUTC: false
			}
		});
	});
	
});