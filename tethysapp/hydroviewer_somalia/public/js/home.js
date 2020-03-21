
var feature_layer;
var feature_layer2;
var current_layer;
var map;

let $loading = $('#view-file-loading');
var m_downloaded_historical_streamflow = false;

function init_map() {

	var base_layer = new ol.layer.Tile({
		source: new ol.source.BingMaps({
			key: 'eLVu8tDRPeQqmBlKAjcw~82nOqZJe2EpKmqd-kQrSmg~AocUZ43djJ-hMBHQdYDyMbT-Enfsk0mtUIGws1WeDuOvjY4EXCH-9OK3edNLDgkc',
			imagerySet: 'Road'
		})
	});

	var streams = new ol.layer.Image({
		source: new ol.source.ImageWMS({
			url: 'https://geoserver.hydroshare.org/geoserver/wms',
			params: { 'LAYERS': 'HS-cc1b93f1d65440aca895787118ed46f1:Somolia' },
			serverType: 'geoserver',
			crossOrigin: 'Anonymous'
		}),
		opacity: 0.5
	});

	var stations = new ol.layer.Image({
		source: new ol.source.ImageWMS({
			url: 'https://geoserver.hydroshare.org/geoserver/wms',
			params: { 'LAYERS': 'HS-cc1b93f1d65440aca895787118ed46f1:SomoliaPoints' },
			serverType: 'geoserver',
			crossOrigin: 'Anonymous',
		})
	});
	feature_layer = stations;

	map = new ol.Map({
		target: 'map',
		layers: [base_layer, streams, stations],
		view: new ol.View({
			center: ol.proj.fromLonLat([46.7943, 5.712]),
			zoom: 6
		})
	});

}

let ajax_url = 'https://geoserver.hydroshare.org/geoserver/wfs?request=GetCapabilities';

let capabilities = $.ajax(ajax_url, {
	type: 'GET',
	data:{
		service: 'WFS',
		version: '1.0.0',
		request: 'GetCapabilities',
		outputFormat: 'text/javascript'
	},
	success: function() {
		let x = capabilities.responseText
		.split('<FeatureTypeList>')[1]
		.split('HS-cc1b93f1d65440aca895787118ed46f1:SomoliaPoints')[1]
		.split('LatLongBoundingBox ')[1]
		.split('/></FeatureType>')[0];

		let minx = Number(x.split('"')[1]);
		let miny = Number(x.split('"')[3]);
		let maxx = Number(x.split('"')[5]);
		let maxy = Number(x.split('"')[7]);

		minx = minx + 2;
		miny = miny + 2;
		maxx = maxx - 2;
		maxy = maxy - 2;

		let extent = ol.proj.transform([minx, miny], 'EPSG:4326', 'EPSG:3857').concat(ol.proj.transform([maxx, maxy], 'EPSG:4326', 'EPSG:3857'));

		map.getView().fit(extent, map.getSize());
	}
});

function get_available_dates(watershed, subbasin, comid) {
	$.ajax({
		type: 'GET',
		url: 'get-available-dates/',
		dataType: 'json',
		data: {
			'watershed': watershed,
			'subbasin': subbasin,
			'comid': comid
		},
		error: function() {
			$('#dates').html(
				'<p class="alert alert-danger" style="text-align: center"><strong>An error occurred while retrieving the available dates</strong></p>'
			);

			setTimeout(function() {
				$('#dates').addClass('hidden')
			}, 5000);
        },
        success: function(dates) {
        	datesParsed = JSON.parse(dates.available_dates);
        	$('#datesSelect').empty();

        	$.each(datesParsed, function(i, p) {
        		var val_str = p.slice(1).join();
        		$('#datesSelect').append($('<option></option>').val(val_str).html(p[0]));
        	});
        }
    });
}

function get_return_periods(watershed, subbasin, comid) {
    $.ajax({
        type: 'GET',
        url: 'get-return-periods/',
        dataType: 'json',
        data: {
            'watershed': watershed,
            'subbasin': subbasin,
            'comid': comid
        },
        error: function() {
            $('#info').html(
                '<p class="alert alert-warning" style="text-align: center"><strong>Return Periods are not available for this dataset.</strong></p>'
            );

            $('#info').removeClass('hidden');

            setTimeout(function() {
                $('#info').addClass('hidden')
            }, 5000);
        },
        success: function(data) {
            $("#container").highcharts().yAxis[0].addPlotBand({
                from: parseFloat(data.return_periods.twenty),
                to: parseFloat(data.return_periods.max),
                color: 'rgba(128,0,128,0.4)',
                id: '20-yr',
                label: {
                    text: '20-yr',
                    align: 'right'
                }
            });
            $("#container").highcharts().yAxis[0].addPlotBand({
                from: parseFloat(data.return_periods.ten),
                to: parseFloat(data.return_periods.twenty),
                color: 'rgba(255,0,0,0.3)',
                id: '10-yr',
                label: {
                    text: '10-yr',
                    align: 'right'
                }
            });
            $("#container").highcharts().yAxis[0].addPlotBand({
                from: parseFloat(data.return_periods.two),
                to: parseFloat(data.return_periods.ten),
                color: 'rgba(255,255,0,0.3)',
                id: '2-yr',
                label: {
                    text: '2-yr',
                    align: 'right'
                }
            });
        }
    });
}

function get_time_series(watershed, subbasin, comid, startdate) {
    $('#forecast-loading').removeClass('hidden');
    $('#forecast-chart').addClass('hidden');
    $('#dates').addClass('hidden');
    $.ajax({
        type: 'GET',
        url: 'get-time-series/',
        data: {
            'watershed': watershed,
            'subbasin': subbasin,
            'comid': comid,
            'startdate': startdate
        },
        error: function() {
            $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the forecast</strong></p>');
            $('#info').removeClass('hidden');

            setTimeout(function() {
                $('#info').addClass('hidden')
            }, 5000);
        },
        success: function(data) {
            if (!data.error) {
                $('#forecast-loading').addClass('hidden');
                $('#dates').removeClass('hidden');
                //$loading.addClass('hidden');
                $('#forecast-chart').removeClass('hidden');
                $('#forecast-chart').html(data);

                //resize main graph
                Plotly.Plots.resize($("#forecast-chart .js-plotly-plot")[0]);

                var params = {
                    watershed_name: watershed,
                    subbasin_name: subbasin,
                    comid: comid,
                    startdate: startdate,
                };

                $('#submit-download-forecast').attr({
                    target: '_blank',
                    href: 'get-forecast-data-csv?' + jQuery.param(params)
                });

                $('#download_forecast').removeClass('hidden');

            } else if (data.error) {
                $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the forecast</strong></p>');
                $('#info').removeClass('hidden');

                setTimeout(function() {
                    $('#info').addClass('hidden')
                }, 5000);
            } else {
                $('#info').html('<p><strong>An unexplainable error occurred.</strong></p>').removeClass('hidden');
            }
        }
    });
}

function get_historic_data(watershed, subbasin, comid, startdate) {
	$('#historical-loading').removeClass('hidden');
	m_downloaded_historical_streamflow = true;
    $.ajax({
        url: 'get-historic-data',
        type: 'GET',
        data: {
            'watershed': watershed,
            'subbasin': subbasin,
            'comid': comid,
            'startdate': startdate
        },
        error: function() {
            $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the historic data</strong></p>');
            $('#info').removeClass('hidden');

            setTimeout(function () {
                $('#info').addClass('hidden')
            }, 5000);
        },
        success: function (data) {
            if (!data.error) {
                $('#historical-loading').addClass('hidden');
                $('#dates').removeClass('hidden');
//                $('#obsdates').removeClass('hidden');
                $loading.addClass('hidden');
                $('#historical-chart').removeClass('hidden');
                $('#historical-chart').html(data);

                //resize main graph
                Plotly.Plots.resize($("#historical-chart .js-plotly-plot")[0]);

                var params = {
                    watershed: watershed,
                	subbasin: subbasin,
                	comid: comid,
                	daily: false
                };

                $('#submit-download-historical').attr({
                    target: '_blank',
                    href: 'get-historic-data-csv?' + jQuery.param(params)
                });

                $('#download_historical').removeClass('hidden');

           		 } else if (data.error) {
           		 	$('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the Historical Data</strong></p>');
           		 	$('#info').removeClass('hidden');

           		 	setTimeout(function() {
           		 		$('#info').addClass('hidden')
           		 	}, 5000);
           		 } else {
           		 	$('#info').html('<p><strong>An unexplainable error occurred.</strong></p>').removeClass('hidden');
           		 }
       		}
    });
};


function get_flow_duration_curve(watershed, subbasin, comid, startdate) {
    $('#fdc-view-file-loading').removeClass('hidden');
    m_downloaded_flow_duration = true;
    $.ajax({
        type: 'GET',
        url: 'get-flow-duration-curve',
        data: {
            'watershed': watershed,
            'subbasin': subbasin,
            'comid': comid,
            'startdate': startdate
        },
        success: function(data) {
            if (!data.error) {
                $('#fdc-loading').addClass('hidden');
                $('#fdc-chart').removeClass('hidden');
                $('#fdc-chart').html(data);
            } else if (data.error) {
                $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the historic data</strong></p>');
                $('#info').removeClass('hidden');

                setTimeout(function() {
                    $('#info').addClass('hidden')
                }, 5000);
            } else {
                $('#info').html('<p><strong>An unexplainable error occurred.</strong></p>').removeClass('hidden');
            }
        }
    });
};

function get_forecast_percent(watershed, subbasin, comid, startdate) {
    $('#mytable').addClass('hidden');
    $.ajax({
        url: 'forecastpercent/',
        type: 'GET',
        data: {
            'comid': comid,
            'watershed': watershed,
            'subbasin': subbasin,
            'startdate': startdate
        },
        error: function() {
            $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the forecast table</strong></p>');
            $('#info').removeClass('hidden');

            setTimeout(function() {
                $('#info').addClass('hidden')
            }, 5000);
        },
        success: function(data) {
            $("#tbody").empty()
            var tbody = document.getElementById('tbody');

            var columNames = {
                'two': 'Percent Exceedance (2-yr)',
                'ten': 'Percent Exceedance (10-yr)',
                'twenty': 'Percent Exceedance (20-yr)',
            };

            for (var object1 in data) {
                if (object1 == "dates") {
                    cellcolor = ""
                } else if (object1 == "two") {
                    cellcolor = "yellow"
                } else if (object1 == "ten") {
                    cellcolor = "red"
                } else if (object1 == "twenty") {
                    cellcolor = "purple"
                }
                if (object1 == "percdates") {
                    var tr = "<tr id=" + object1.toString() + "><th>Dates</th>";
                    for (var value1 in data[object1]) {
                        tr += "<th>" + data[object1][value1].toString() + "</th>"
                    }
                    tr += "</tr>";
                    tbody.innerHTML += tr;
                } else {
                    var tr = "<tr id=" + object1.toString() + "><td>" + columNames[object1.toString()] + "</td>";
                    for (var value1 in data[object1]) {
                        if (parseInt(data[object1][value1]) == 0) {
                            tr += "<td class=" + cellcolor + "zero>" + data[object1][value1].toString() + "</td>"
                        } else if (parseInt(data[object1][value1]) <= 20) {
                            tr += "<td class=" + cellcolor + "twenty>" + data[object1][value1].toString() + "</td>"
                        } else if (parseInt(data[object1][value1]) <= 40) {
                            tr += "<td class=" + cellcolor + "fourty>" + data[object1][value1].toString() + "</td>"
                        } else if (parseInt(data[object1][value1]) <= 60) {
                            tr += "<td class=" + cellcolor + "sixty>" + data[object1][value1].toString() + "</td>"
                        } else if (parseInt(data[object1][value1]) <= 80) {
                            tr += "<td class=" + cellcolor + "eighty>" + data[object1][value1].toString() + "</td>"
                        } else {
                            tr += "<td class=" + cellcolor + "hundred>" + data[object1][value1].toString() + "</td>"
                        }
                    }
                    tr += "</tr>";
                    tbody.innerHTML += tr;
                }
            }

            $("#twenty").prependTo("#mytable");
            $("#ten").prependTo("#mytable");
            $("#two").prependTo("#mytable");
            $("#percdates").prependTo("#mytable");
            $('#mytable').removeClass('hidden');
        }

    })
}

function get_dailyAverages (watershed, subbasin, comid) {
	$('#dailyAverages-loading').removeClass('hidden');
	m_downloaded_historical_streamflow = true;
    $.ajax({
        url: 'get-dailyAverages',
        type: 'GET',
        data: {
            'watershed': watershed,
            'subbasin': subbasin,
            'comid': comid
        },
        error: function() {
            $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the data</strong></p>');
            $('#info').removeClass('hidden');

            setTimeout(function () {
                $('#info').addClass('hidden')
            }, 5000);
        },
        success: function (data) {
            if (!data.error) {
                $('#dailyAverages-loading').addClass('hidden');
                $('#dates').removeClass('hidden');
//                $('#obsdates').removeClass('hidden');
                $loading.addClass('hidden');
                $('#dailyAverages-chart').removeClass('hidden');
                $('#dailyAverages-chart').html(data);

                //resize main graph
                Plotly.Plots.resize($("#dailyAverages-chart .js-plotly-plot")[0]);

           		 } else if (data.error) {
           		 	$('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the Data</strong></p>');
           		 	$('#info').removeClass('hidden');

           		 	setTimeout(function() {
           		 		$('#info').addClass('hidden')
           		 	}, 5000);
           		 } else {
           		 	$('#info').html('<p><strong>An unexplainable error occurred.</strong></p>').removeClass('hidden');
           		 }
       		}
    });
};

function get_monthlyAverages (watershed, subbasin, comid) {
	$('#monthlyAverages-loading').removeClass('hidden');
	m_downloaded_historical_streamflow = true;
    $.ajax({
        url: 'get-monthlyAverages',
        type: 'GET',
        data: {
            'watershed': watershed,
            'subbasin': subbasin,
            'comid': comid
        },
        error: function() {
            $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the data</strong></p>');
            $('#info').removeClass('hidden');

            setTimeout(function () {
                $('#info').addClass('hidden')
            }, 5000);
        },
        success: function (data) {
            if (!data.error) {
                $('#monthlyAverages-loading').addClass('hidden');
                $('#dates').removeClass('hidden');
//                $('#obsdates').removeClass('hidden');
                $loading.addClass('hidden');
                $('#monthlyAverages-chart').removeClass('hidden');
                $('#monthlyAverages-chart').html(data);

                //resize main graph
                Plotly.Plots.resize($("#monthlyAverages-chart .js-plotly-plot")[0]);

           		 } else if (data.error) {
           		 	$('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the Data</strong></p>');
           		 	$('#info').removeClass('hidden');

           		 	setTimeout(function() {
           		 		$('#info').addClass('hidden')
           		 	}, 5000);
           		 } else {
           		 	$('#info').html('<p><strong>An unexplainable error occurred.</strong></p>').removeClass('hidden');
           		 }
       		}
    });
};

function map_events() {
	map.on('pointermove', function(evt) {
		if (evt.dragging) {
			return;
		}
		var pixel = map.getEventPixel(evt.originalEvent);
		var hit = map.forEachLayerAtPixel(pixel, function(layer) {
			if (layer == feature_layer) {
				current_layer = layer;
				return true;
			}
			});
		map.getTargetElement().style.cursor = hit ? 'pointer' : '';
	});

	map.on("singleclick", function(evt) {

		if (map.getTargetElement().style.cursor == "pointer") {

			var view = map.getView();
			var viewResolution = view.getResolution();
			var wms_url = current_layer.getSource().getGetFeatureInfoUrl(evt.coordinate, viewResolution, view.getProjection(), { 'INFO_FORMAT': 'application/json' });

			if (wms_url) {
				$("#obsgraph").modal('show');
				$("#tbody").empty()
				$('#forecast-chart').addClass('hidden');
				$('#historical-chart').addClass('hidden');
				$('#fdc-chart').addClass('hidden');
				$('#dailyAverages-chart').addClass('hidden');
				$('#monthlyAverages-chart').addClass('hidden');
				$('#forecast-loading').removeClass('hidden');
				$('#historical-loading').removeClass('hidden');
				$('#fdc-loading').removeClass('hidden');
				$("#station-info").empty()
				$('#download_forecast').addClass('hidden');
                $('#download_historical').addClass('hidden');

				$.ajax({
					type: "GET",
					url: wms_url,
					dataType: 'json',
					success: function (result) {
						var startdate = '';
						var watershed = result["features"][0]["properties"]["watershed"];
		         		var subbasin = result["features"][0]["properties"]["subbasin"];
		         		var comid = result["features"][0]["properties"]["COMID"];
		         		$("#station-info").append('<h3 id="Current-Watershed-Tab">Current Watershed: '+ watershed
                        			+ '</h3><h5 id="Subbasin-Name-Tab">Subbasin Name: '
                        			+ subbasin + '</h3><h5 id="COMID-Tab">Station COMID: '
                        			+ comid+ '</h5><h5>Country: '+ 'Somalia');
                        get_available_dates(watershed, subbasin, comid);
                        get_time_series(watershed, subbasin, comid, startdate);
                        get_historic_data(watershed, subbasin, comid, startdate);
                        get_flow_duration_curve(watershed, subbasin, comid, startdate);
                        get_forecast_percent(watershed, subbasin, comid, startdate);
                        get_dailyAverages (watershed, subbasin, comid);
                        get_monthlyAverages (watershed, subbasin, comid);
                    }
                });
            }
		}

	});
}



function resize_graphs() {
    $("#forecast_tab_link").click(function() {
        Plotly.Plots.resize($("#forecast-chart .js-plotly-plot")[0]);
    });
    $("#historical_tab_link").click(function() {
    	if (m_downloaded_historical_streamflow) {
    		Plotly.Plots.resize($("#historical-chart .js-plotly-plot")[0]);
    	}
    });
    $("#fdc_tab_link").click(function() {
    	Plotly.Plots.resize($("#fdc-chart .js-plotly-plot")[0]);
    });
    $("#dailyAverages_tab_link").click(function() {
    	Plotly.Plots.resize($("#dailyAverages-chart .js-plotly-plot")[0]);
    });
    $("#monthlyAverages_tab_link").click(function() {
    	Plotly.Plots.resize($("#monthlyAverages-chart .js-plotly-plot")[0]);
    });
};

$(function() {
	$("#app-content-wrapper").removeClass('show-nav');
	$(".toggle-nav").removeClass('toggle-nav');

	//make sure active Plotly plots resize on window resize
    window.onresize = function() {
        $('#graph .modal-body .tab-pane.active .js-plotly-plot').each(function(){
            Plotly.Plots.resize($(this)[0]);
        });
    };
    init_map();
    map_events();
    resize_graphs();

    $('#datesSelect').change(function() { //when date is changed
        var sel_val = ($('#datesSelect option:selected').val()).split(',');
        console.log(sel_val)
        console.log(sel_val[0])
        var startdate = sel_val[0];
        var watershed = sel_val[1];
        var subbasin = sel_val[2];
        var comid = sel_val[3];
        $('#forecast-loading').removeClass('hidden');
        get_time_series(watershed, subbasin, comid, startdate);
        get_forecast_percent(watershed, subbasin, comid, startdate);
    });
});
