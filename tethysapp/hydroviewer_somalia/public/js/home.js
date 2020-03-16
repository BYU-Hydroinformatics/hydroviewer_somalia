// Getting the csrf token
let csrftoken = Cookies.get('csrftoken');

function csrfSafeMethod(method) {
    // these HTTP methods do not require CSRF protection
    return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
}

$.ajaxSetup({
    beforeSend: function(xhr, settings) {
        if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
            xhr.setRequestHeader("X-CSRFToken", csrftoken);
        }
    }
});

var feature_layer;
var current_layer;
var map;

let $loading = $('#view-file-loading');
var m_downloaded_historical_streamflow = false;

function init_map() {

	var base_layer = new ol.layer.Tile({
		source: new ol.source.BingMaps({
			key: 'eLVu8tDRPeQqmBlKAjcw~82nOqZJe2EpKmqd-kQrSmg~AocUZ43djJ-hMBHQdYDyMbT-Enfsk0mtUIGws1WeDuOvjY4EXCH-9OK3edNLDgkc',
			imagerySet: 'Road'
//			imagerySet: 'AerialWithLabels'
		})
	});

//	var streams = new ol.layer.Image({
//		source: new ol.source.ImageWMS({
//			url: 'https://tethys.byu.edu/geoserver/colombia_hydroviewer/wms',
//			params: { 'LAYERS': 'south_america-colombia-drainage_line' },
//			serverType: 'geoserver',
//			crossOrigin: 'Anonymous'
//		}),
//		opacity: 0.5
//	});
//
//	var stations = new ol.layer.Image({
//		source: new ol.source.ImageWMS({
//			url: 'https://tethys.byu.edu/geoserver/colombia_hydroviewer/wms',
//			params: { 'LAYERS': 'IDEAM_Stations' },
//			serverType: 'geoserver',
//			crossOrigin: 'Anonymous'
//		})
//	});
//
	var streams = new ol.layer.Image({
		source: new ol.source.ImageWMS({
			url: 'http://geoserver.org/somalia_rivers/wms',
			params: { 'LAYERS': 'somalia_rivers:Somalia' },
			serverType: 'geoserver',
			crossOrigin: 'Anonymous'
		}),
		opacity: 0.5
	});

	var stations = new ol.layer.Image({
		source: new ol.source.ImageWMS({
			url: 'http://localhost:8080/geoserver/somalia_rivers/wms',
			params: { 'LAYERS': 'somalia_points' },
			serverType: 'geoserver',
			crossOrigin: 'Anonymous'
		})
	});
	feature_layer = stations;

	map = new ol.Map({
		target: 'map',
		layers: [base_layer, streams, stations],
		view: new ol.View({
			center: ol.proj.fromLonLat([46.7943, 5.712]),
			zoom: 5
		})
	});

}

//let ajax_url = 'https://tethys.byu.edu/geoserver/colombia_hydroviewer/wfs?request=GetCapabilities';
let ajax_url = 'http://localhost:8080/geoserver/somalia_river/wfs?request=GetCapabilities';

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
		.split('colombia_hydroviewer:south_america-colombia-drainage_line')[1]
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

function get_discharge_info (stationcode, stationname) {
	$('#observed-loading-Q').removeClass('hidden');
    $.ajax({
        url: 'get-discharge-data',
        type: 'GET',
        data: {'stationcode' : stationcode, 'stationname': stationname},
        error: function () {
            $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the observed data</strong></p>');
            $('#info').removeClass('hidden');

            setTimeout(function () {
                $('#info').addClass('hidden')
            }, 5000);
        },
        success: function (data) {
            if (!data.error) {
                $('#observed-loading-Q').addClass('hidden');
                $('#dates').removeClass('hidden');
//                $('#obsdates').removeClass('hidden');
                $loading.addClass('hidden');
                $('#observed-chart-Q').removeClass('hidden');
                $('#observed-chart-Q').html(data);

                //resize main graph
                Plotly.Plots.resize($("#observed-chart-Q .js-plotly-plot")[0]);

                var params = {
                    stationcode: stationcode,
                    stationname: stationname,
                };

                $('#submit-download-observed-discharge').attr({
                    target: '_blank',
                    href: 'get-observed-discharge-csv?' + jQuery.param(params)
                });

                $('#download_observed_discharge').removeClass('hidden');

            } else if (data.error) {
            	$('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the Observed Data</strong></p>');
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

function get_simulated_data (watershed, subbasin, streamcomid, stationcode, stationname) {
	$('#simulated-loading-Q').removeClass('hidden');
	m_downloaded_historical_streamflow = true;
    $.ajax({
        url: 'get-simulated-data',
        type: 'GET',
        data: {
            'watershed': watershed,
            'subbasin': subbasin,
            'streamcomid': streamcomid,
            'stationcode':stationcode,
            'stationname': stationname
        },
        error: function() {
            $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the simulated data</strong></p>');
            $('#info').removeClass('hidden');

            setTimeout(function () {
                $('#info').addClass('hidden')
            }, 5000);
        },
        success: function (data) {
            if (!data.error) {
                $('#simulated-loading-Q').addClass('hidden');
                $('#dates').removeClass('hidden');
//                $('#obsdates').removeClass('hidden');
                $loading.addClass('hidden');
                $('#simulated-chart-Q').removeClass('hidden');
                $('#simulated-chart-Q').html(data);

                //resize main graph
                Plotly.Plots.resize($("#simulated-chart-Q .js-plotly-plot")[0]);

                var params = {
                    watershed: watershed,
                	subbasin: subbasin,
                	streamcomid: streamcomid,
                	stationcode:stationcode,
                	stationname: stationname
                };

                $('#submit-download-simulated-discharge').attr({
                    target: '_blank',
                    href: 'get-simulated-discharge-csv?' + jQuery.param(params)
                });

                $('#download_simulated_discharge').removeClass('hidden');

           		 } else if (data.error) {
           		 	$('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the Simulated Data</strong></p>');
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

function get_hydrographs (watershed, subbasin, streamcomid, stationcode, stationname) {
	$('#hydrographs-loading').removeClass('hidden');
	m_downloaded_historical_streamflow = true;
    $.ajax({
        url: 'get-hydrographs',
        type: 'GET',
        data: {
            'watershed': watershed,
            'subbasin': subbasin,
            'streamcomid': streamcomid,
            'stationcode': stationcode,
            'stationname': stationname
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
                $('#hydrographs-loading').addClass('hidden');
                $('#dates').removeClass('hidden');
//                $('#obsdates').removeClass('hidden');
                $loading.addClass('hidden');
                $('#hydrographs-chart').removeClass('hidden');
                $('#hydrographs-chart').html(data);

                //resize main graph
                Plotly.Plots.resize($("#hydrographs-chart .js-plotly-plot")[0]);

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

function get_dailyAverages (watershed, subbasin, streamcomid, stationcode, stationname) {
	$('#dailyAverages-loading').removeClass('hidden');
	m_downloaded_historical_streamflow = true;
    $.ajax({
        url: 'get-dailyAverages',
        type: 'GET',
        data: {
            'watershed': watershed,
            'subbasin': subbasin,
            'streamcomid': streamcomid,
            'stationcode': stationcode,
            'stationname': stationname
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

function get_monthlyAverages (watershed, subbasin, streamcomid, stationcode, stationname) {
	$('#monthlyAverages-loading').removeClass('hidden');
	m_downloaded_historical_streamflow = true;
    $.ajax({
        url: 'get-monthlyAverages',
        type: 'GET',
        data: {
            'watershed': watershed,
            'subbasin': subbasin,
            'streamcomid': streamcomid,
            'stationcode': stationcode,
            'stationname': stationname
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

function get_scatterPlot (watershed, subbasin, streamcomid, stationcode, stationname) {
	$('#scatterPlot-loading').removeClass('hidden');
	m_downloaded_historical_streamflow = true;
    $.ajax({
        url: 'get-scatterPlot',
        type: 'GET',
        data: {
            'watershed': watershed,
            'subbasin': subbasin,
            'streamcomid': streamcomid,
            'stationcode': stationcode,
            'stationname': stationname
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
                $('#scatterPlot-loading').addClass('hidden');
                $('#dates').removeClass('hidden');
//                $('#obsdates').removeClass('hidden');
                $loading.addClass('hidden');
                $('#scatterPlot-chart').removeClass('hidden');
                $('#scatterPlot-chart').html(data);

                //resize main graph
                Plotly.Plots.resize($("#scatterPlot-chart .js-plotly-plot")[0]);

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

function get_scatterPlotLogScale (watershed, subbasin, streamcomid, stationcode, stationname) {
	$('#scatterPlotLogScale-loading').removeClass('hidden');
	m_downloaded_historical_streamflow = true;
    $.ajax({
        url: 'get-scatterPlotLogScale',
        type: 'GET',
        data: {
            'watershed': watershed,
            'subbasin': subbasin,
            'streamcomid': streamcomid,
            'stationcode': stationcode,
            'stationname': stationname
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
                $('#scatterPlotLogScale-loading').addClass('hidden');
                $('#dates').removeClass('hidden');
//                $('#obsdates').removeClass('hidden');
                $loading.addClass('hidden');
                $('#scatterPlotLogScale-chart').removeClass('hidden');
                $('#scatterPlotLogScale-chart').html(data);

                //resize main graph
                Plotly.Plots.resize($("#scatterPlotLogScale-chart .js-plotly-plot")[0]);

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

function get_volumeAnalysis (watershed, subbasin, streamcomid, stationcode, stationname) {
	$('#volumeAnalysis-loading').removeClass('hidden');
	m_downloaded_historical_streamflow = true;
    $.ajax({
        url: 'get-volumeAnalysis',
        type: 'GET',
        data: {
            'watershed': watershed,
            'subbasin': subbasin,
            'streamcomid': streamcomid,
            'stationcode': stationcode,
            'stationname': stationname
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
                $('#volumeAnalysis-loading').addClass('hidden');
                $('#dates').removeClass('hidden');
//                $('#obsdates').removeClass('hidden');
                $loading.addClass('hidden');
                $('#volumeAnalysis-chart').removeClass('hidden');
                $('#volumeAnalysis-chart').html(data);

                //resize main graph
                Plotly.Plots.resize($("#volumeAnalysis-chart .js-plotly-plot")[0]);

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

// Ajax for Volume Table
function createVolumeTable(watershed, subbasin, streamcomid, stationcode, stationname) {
	$('#volumeAnalysis-loading').removeClass('hidden');
	m_downloaded_historical_streamflow = true;
    $.ajax({
        url : "volume-table-ajax/", // the endpoint
        type: 'GET',
        data: {
            'watershed': watershed,
            'subbasin': subbasin,
            'streamcomid': streamcomid,
            'stationcode': stationcode,
            'stationname': stationname
        },

        // handle a successful response
        success : function(resp) {
            //console.log(resp);
            let sim_volume = resp["sim_volume"].toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
            let obs_volume = resp["obs_volume"].toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
            $("#volume_table_div").show();
            $("#volume_table").html(`<table class="table table-hover table-striped">\
                                        <thead>\
                                          <tr>\
                                            <th>Simulated Data Volume (Mm<sup>3</sup>)</th>\
                                            <th>Observed Data Volume (Mm<sup>3</sup>)</th>\
                                          </tr>\
                                        </thead>\
                                        <tbody>\
                                          <tr>\
                                            <td>${sim_volume}</td>\
                                            <td>${obs_volume}</td>\
                                          </tr>\
                                        </tbody>\
                                      </table>`);
        },

        // handle a non-successful response
        error : function(xhr, errmsg, err) {
            $('#results').html("<div class='alert-box alert radius' data-alert>Oops! We have encountered an error: "+errmsg+".</div>"); // add the error to the dom
            console.log(xhr.status + ": " + xhr.responseText); // provide a bit more info about the error to the console
        }
    });
}

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
				$('#observed-chart-Q').addClass('hidden');
				$('#simulated-chart-Q').addClass('hidden');
				$('#hydrographs-chart').addClass('hidden');
				$('#dailyAverages-chart').addClass('hidden');
				$('#monthlyAverages-chart').addClass('hidden');
				$('#scatterPlot-chart').addClass('hidden');
				$('#scatterPlotLogScale-chart').addClass('hidden');
				$('#volumeAnalysis-chart').addClass('hidden');
				$('#observed-loading-Q').removeClass('hidden');
				$('#simulated-loading-Q').removeClass('hidden');
				$('#hydrographs-loading').removeClass('hidden');
				$('#dailyAverages-loading').removeClass('hidden');
				$('#monthlyAverages-loading').removeClass('hidden');
				$('#scatterPlot-loading').removeClass('hidden');
				$('#scatterPlotLogScale-loading').removeClass('hidden');
				$('#volumeAnalysis-loading').removeClass('hidden');
				$("#station-info").empty()
				$('#download_observed_discharge').addClass('hidden');
                $('#download_simulated_discharge').addClass('hidden');

				$.ajax({
					type: "GET",
					url: wms_url,
					dataType: 'json',
					success: function (result) {
						var watershed = 'south_america' //OJO buscar como hacerla generica
		         		var subbasin = 'continental' //OJO buscar como hacerla generica
		         		stationcode = result["features"][0]["properties"]["ID"];
		         		stationname = result["features"][0]["properties"]["Name"];
		         		streamcomid = result["features"][0]["properties"]["COMID"];
		         		stream = result["features"][0]["properties"]["Stream_Nam"];
		         		$("#station-info").append('<h3 id="Station-Name-Tab">Current Station: '+ stationname
                        			+ '</h3><h5 id="Station-Code-Tab">Station Code: '
                        			+ stationcode + '</h3><h5 id="COMID-Tab">Station COMID: '
                        			+ streamcomid+ '</h5><h5>Stream: '+ stream);
                        get_discharge_info (stationcode, stationname);
                        get_simulated_data (watershed, subbasin, streamcomid, stationcode, stationname);
                        get_hydrographs (watershed, subbasin, streamcomid, stationcode, stationname);
                        get_dailyAverages (watershed, subbasin, streamcomid, stationcode, stationname);
                        get_monthlyAverages (watershed, subbasin, streamcomid, stationcode, stationname);
                        get_scatterPlot (watershed, subbasin, streamcomid, stationcode, stationname);
                        get_scatterPlotLogScale (watershed, subbasin, streamcomid, stationcode, stationname);
                        get_volumeAnalysis (watershed, subbasin, streamcomid, stationcode, stationname);
                        createVolumeTable(watershed, subbasin, streamcomid, stationcode, stationname);
                    }
                });
            }
		}

	});
}



function resize_graphs() {
    $("#observedQ_tab_link").click(function() {
        Plotly.Plots.resize($("#observed-chart-Q .js-plotly-plot")[0]);
    });
    $("#simulatedQ_tab_link").click(function() {
    	if (m_downloaded_historical_streamflow) {
    		Plotly.Plots.resize($("#simulated-chart-Q .js-plotly-plot")[0]);
    	}
    });
    $("#hydrographs_tab_link").click(function() {
    	Plotly.Plots.resize($("#hydrographs-chart .js-plotly-plot")[0]);
    });
    $("#dailyAverages_tab_link").click(function() {
    	Plotly.Plots.resize($("#dailyAverages-chart .js-plotly-plot")[0]);
    });
    $("#monthlyAverages_tab_link").click(function() {
    	Plotly.Plots.resize($("#monthlyAverages-chart .js-plotly-plot")[0]);
    });
    $("#scatterPlot_tab_link").click(function() {
    	Plotly.Plots.resize($("#scatterPlot-chart .js-plotly-plot")[0]);
    });
    $("#scatterPlotLogScale_tab_link").click(function() {
    	Plotly.Plots.resize($("#scatterPlotLogScale-chart .js-plotly-plot")[0]);
    });
    $("#volumeAnalysis_tab_link").click(function() {
    	Plotly.Plots.resize($("#volumeAnalysis-chart .js-plotly-plot")[0]);
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

});

// Function for the select2 metric selection tool
$(document).ready(function() {
    $('#metric_select2').select2({ width: 'resolve' });
});

$('#metric_select2').on("select2:close", function(e) { // Display optional parameters
    //console.log("triggered!");
    let select_val = $( '#metric_select2' ).val();
	//console.log(select_val);

    if ( select_val.includes("MASE") ) {
        $('#mase_param_div').fadeIn()
    } else {
        $('#mase_param_div').fadeOut()
    }

    if ( select_val.includes("d (Mod.)") ) {
        $('#dmod_param_div').fadeIn()
    } else {
        $('#dmod_param_div').fadeOut()
    }

    if ( select_val.includes("NSE (Mod.)") ) {
        $('#nse_mod_param_div').fadeIn()
    } else {
        $('#nse_mod_param_div').fadeOut()
    }

    if ( select_val.includes("E1'") ) {
        $('#lm_eff_param_div').fadeIn()
    } else {
        $('#lm_eff_param_div').fadeOut()
    }

    if ( select_val.includes("D1'") ) {
        $('#d1_p_param_div').fadeIn()
    } else {
        $('#d1_p_param_div').fadeOut()
    }

    if ( select_val.includes("H6 (MHE)") ) {
        $('#mean_h6_param_div').fadeIn()
    } else {
        $('#mean_h6_param_div').fadeOut()
    }

    if ( select_val.includes("H6 (MAHE)") ) {
        $('#mean_abs_H6_param_div').fadeIn()
    } else {
        $('#mean_abs_H6_param_div').fadeOut()
    }

    if ( select_val.includes("H6 (RMSHE)") ) {
        $('#rms_H6_param_div').fadeIn()
    } else {
        $('#rms_H6_param_div').fadeOut()
    }
});

// Event handler for the make table button
$(document).ready(function(){

    $("#make-table").click(function(){
        //console.log('Make Table Event Triggered');
        var model = $('#model option:selected').text();
        var watershed = 'south_america' //OJO buscar como hacerla generica
        var subbasin = 'continental' //OJO buscar como hacerla generica
        var startdate = '';
        let xName = $("#Station-Name-Tab")
        let xCode = $("#Station-Code-Tab")
        let xComid = $("#COMID-Tab")
        let htmlName = xName.html()
        let htmlCode = xCode.html()
        let htmlComid = xComid.html()
        var arName = htmlName.split(': ')
        var arCode = htmlCode.split(': ')
        var arComid = htmlComid.split(': ')
        let stationname = arName[1];
        let stationcode = arCode[1];
        let streamcomid = arComid[1];

        let selected_metrics = $( '#metric_select2' ).val();  // Selected Metrics
		let additionalParametersNameList = ["mase_m", "dmod_j", "nse_mod_j", "h6_k_MHE", "h6_k_AHE", "h6_k_RMSHE", "lm_x_bar", "d1_p_x_bar"];
		let additionalParametersValuesList = [];

		let getData = {
			'watershed': watershed,
			'subbasin': subbasin,
			'streamcomid': streamcomid,
			'stationcode': stationcode,
			'stationname': stationname,
			'metrics': selected_metrics,
		}

		for (let i = 0; i < additionalParametersNameList.length; i++) {
			metricAbbr = additionalParametersNameList[i];
			getData[metricAbbr] = $(`#${metricAbbr}`).val();
		}

		// Creating the table
		$.ajax({
			url : "make-table-ajax", // the endpoint
			type : "GET", // http method
			data: getData,
//			contentType : "json",

			// handle a successful response
			success : function(resp) {
				$("#metric-table").show();
				$('#table').html(resp); // Render the Table
				//console.log(resp)
				//console.log("success"); // another sanity check
			},

			// handle a non-successful response
			error : function(xhr, errmsg, err) {
				$('#table').html("<div class='alert-box alert radius' data-alert>Oops! We have encountered an error: "+errmsg+".</div>"); // add the error to the dom
				console.log(xhr.status + ": " + xhr.responseText); // provide a bit more info about the error to the console
			}
		});
	});
});
