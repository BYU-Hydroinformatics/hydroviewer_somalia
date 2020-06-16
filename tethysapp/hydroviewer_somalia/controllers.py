from django.shortcuts import render
from tethys_sdk.gizmos import PlotlyView
from django.http import HttpResponse, JsonResponse

import pandas as pd
import requests
import json
import ast
import numpy as np
import datetime as dt
import plotly.graph_objs as go
import scipy.stats as sp
from csv import writer as csv_writer
import geoglows


def home(request):
    """
    Controller for the app home page.
    """

    context = {}

    return render(request, 'hydroviewer_somalia/home.html', context)


def get_available_dates(request):
    get_data = request.GET

    comid = get_data['comid']

    # request_params
    request_params = dict(watershed_name=watershed, subbasin_name=subbasin, reach_id=comid)

    # Token is for the demo account
    request_headers = dict(Authorization='Token 1adf07d983552705cd86ac681f3717510b6937f6')

    res = requests.get('https://tethys2.byu.edu/apps/streamflow-prediction-tool/api/GetAvailableDates/',
                       params=request_params, headers=request_headers)

    dates = []
    for date in eval(res.content):
        if len(date) == 10:
            date_mod = date + '000'
            date_f = dt.datetime.strptime(date_mod, '%Y%m%d.%H%M').strftime('%Y-%m-%d %H:%M')
        else:
            date_f = dt.datetime.strptime(date, '%Y%m%d.%H%M').strftime('%Y-%m-%d %H:%M')
        dates.append([date_f, date, watershed, subbasin, comid])

    dates.append(['Select Date', dates[-1][1]])
    dates.reverse()

    return JsonResponse({
        "success": "Data analysis complete!",
        "available_dates": json.dumps(dates)
    })


def get_time_series(request):
    get_data = request.GET
    try:
        comid = get_data['comid']
        stats = geoglows.streamflow.forecast_stats(comid)
        rperiods = geoglows.streamflow.return_periods(comid)
        return JsonResponse({'plot': geoglows.plots.forecast_stats(stats, rperiods, outformat='plotly_html')})
    except Exception as e:
        print(str(e))
        return JsonResponse({'error': 'No data found for the selected reach.'})


def get_return_periods(request):
    get_data = request.GET

    watershed = get_data['watershed']
    subbasin = get_data['subbasin']
    comid = get_data['comid']

    # request_params
    request_params = dict(watershed_name=watershed, subbasin_name=subbasin, reach_id=comid)

    # Token is for the demo account
    request_headers = dict(Authorization='Token 1adf07d983552705cd86ac681f3717510b6937f6')

    res = requests.get('https://tethys2.byu.edu/apps/streamflow-prediction-tool/api/GetReturnPeriods/',
                       params=request_params, headers=request_headers)

    return eval(res.content)


def get_return_period_ploty_info(request, datetime_start, datetime_end,
                                 band_alt_max=-9999):
    """
    Get shapes and annotations for plotly plot
    """

    # Return Period Section
    return_period_data = get_return_periods(request)
    return_max = float(return_period_data["max"])
    return_20 = float(return_period_data["twenty"])
    return_10 = float(return_period_data["ten"])
    return_2 = float(return_period_data["two"])

    # plotly info section
    shapes = [
        # return 20 band
        dict(
            type='rect',
            xref='x',
            yref='y',
            x0=datetime_start,
            y0=return_20,
            x1=datetime_end,
            y1=max(return_max, band_alt_max),
            line=dict(width=0),
            fillcolor='rgba(128, 0, 128, 0.4)',
        ),
        # return 10 band
        dict(
            type='rect',
            xref='x',
            yref='y',
            x0=datetime_start,
            y0=return_10,
            x1=datetime_end,
            y1=return_20,
            line=dict(width=0),
            fillcolor='rgba(255, 0, 0, 0.4)',
        ),
        # return 2 band
        dict(
            type='rect',
            xref='x',
            yref='y',
            x0=datetime_start,
            y0=return_2,
            x1=datetime_end,
            y1=return_10,
            line=dict(width=0),
            fillcolor='rgba(255, 255, 0, 0.4)',
        ),
    ]
    annotations = [
        # return max
        dict(
            x=datetime_end,
            y=return_max,
            xref='x',
            yref='y',
            text='Max. ({:.1f})'.format(return_max),
            showarrow=False,
            xanchor='left',
        ),
        # return 20 band
        dict(
            x=datetime_end,
            y=return_20,
            xref='x',
            yref='y',
            text='20-yr ({:.1f})'.format(return_20),
            showarrow=False,
            xanchor='left',
        ),
        # return 10 band
        dict(
            x=datetime_end,
            y=return_10,
            xref='x',
            yref='y',
            text='10-yr ({:.1f})'.format(return_10),
            showarrow=False,
            xanchor='left',
        ),
        # return 2 band
        dict(
            x=datetime_end,
            y=return_2,
            xref='x',
            yref='y',
            text='2-yr ({:.1f})'.format(return_2),
            showarrow=False,
            xanchor='left',
        ),
    ]

    return shapes, annotations


def get_units_title(unit_type):
    """
    Get the title for units
    """
    units_title = "m"
    if unit_type == 'english':
        units_title = "ft"
    return units_title


def forecastpercent(request):
    # Check if its an ajax post request
    if request.is_ajax() and request.method == 'GET':
        comid = request.GET.get('comid')
        stats = geoglows.streamflow.forecast_stats(comid)
        ensems = geoglows.streamflow.forecast_ensembles(comid)
        rperiods = geoglows.streamflow.return_periods(comid)
        return JsonResponse({'table': geoglows.plots.probabilities_table(stats, ensems, rperiods)})


def get_historic_data(request):
    """""
    Returns ERA Interim hydrograph
    """""

    get_data = request.GET

    try:
        comid = get_data['comid']
        hist = geoglows.streamflow.historic_simulation(comid)
        rperiods = geoglows.streamflow.return_periods(comid)
        return JsonResponse({'plot': geoglows.plots.historic_simulation(hist, rperiods, outformat='plotly_html')})

    except Exception as e:
        print(str(e))
        return JsonResponse({'error': 'No historic data found for the selected reach.'})


def get_flow_duration_curve(request):
    get_data = request.GET

    try:
        comid = get_data['comid']
        hist = geoglows.streamflow.historic_simulation(comid)
        return JsonResponse({'plot': geoglows.plots.flow_duration_curve(hist, outformat='plotly_html')})

    except Exception as e:
        print(str(e))
        return JsonResponse({'error': 'No historic data found for calculating flow duration curve.'})


def get_dailyAverages(request):
    """
    Get historic simulations from ERA Interim
    """
    get_data = request.GET

    try:
        comid = get_data['comid']
        day = geoglows.streamflow.daily_averages(comid)
        return JsonResponse({'plot': geoglows.plots.daily_averages(day, outformat='plotly_html')})

    except Exception as e:
        print(str(e))
        return JsonResponse({'error': 'No data found for the selected station.'})


def get_monthlyAverages(request):
    """
    Get historic simulations from ERA Interim
    """
    get_data = request.GET

    try:
        comid = get_data['comid']
        month = geoglows.streamflow.monthly_averages(comid)
        return JsonResponse({'plot': geoglows.plots.daily_averages(month, outformat='plotly_html')})

    except Exception as e:
        print(str(e))
        return JsonResponse({'error': 'No data found for the selected station.'})


def get_historic_data_csv(request):
    """
    Get historic simulations from ERA Interim
    """

    try:
        get_data = request.GET
        watershed = get_data['watershed']
        subbasin = get_data['subbasin']
        comid = get_data['comid']

        # request_params
        request_params = dict(watershed_name=watershed, subbasin_name=subbasin, reach_id=comid, return_format='csv')

        # Token is for the demo account
        request_headers = dict(Authorization='Token 1adf07d983552705cd86ac681f3717510b6937f6')

        era_res = requests.get('https://tethys2.byu.edu/apps/streamflow-prediction-tool/api/GetHistoricData/',
                               params=request_params, headers=request_headers)

        era_pairs = era_res.content.splitlines()
        era_pairs.pop(0)

        era_dates = []
        era_values = []

        for era_pair in era_pairs:
            era_pair = era_pair.decode('utf-8')
            era_dates.append(dt.datetime.strptime(era_pair.split(',')[0], '%Y-%m-%d %H:%M:%S'))
            era_values.append(float(era_pair.split(',')[1]))

        pairs = [list(a) for a in zip(era_dates, era_values)]

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename=historic_streamflow_{0}.csv'.format(comid)

        writer = csv_writer(response)
        writer.writerow(['datetime', 'flow (m3/s)'])

        for row_data in pairs:
            writer.writerow(row_data)

        return response

    except Exception as e:
        print(str(e))
        return JsonResponse({'error': 'An unknown error occurred while retrieving the Discharge Data.'})


def get_forecast_data_csv(request):
    """""
    Returns Forecast data as csv
    """""

    get_data = request.GET

    try:
        # model = get_data['model']
        watershed = get_data['watershed_name']
        subbasin = get_data['subbasin_name']
        comid = get_data['comid']
        if get_data['startdate'] != '':
            startdate = get_data['startdate']
        else:
            startdate = 'most_recent'

        # request_params
        request_params = dict(watershed_name=watershed, subbasin_name=subbasin, reach_id=comid, return_format='csv')

        # Token is for the demo account
        request_headers = dict(Authorization='Token 1adf07d983552705cd86ac681f3717510b6937f6')

        res = requests.get('https://tethys2.byu.edu/apps/streamflow-prediction-tool/api/GetAvailableDates/',
                           params=request_params, headers=request_headers)

        qout_data = res.content.decode('utf-8').splitlines()
        qout_data.pop(0)

        init_time = qout_data[0].split(',')[0].split(' ')[0]
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename=streamflow_forecast_{0}_{1}_{2}_{3}.csv'.format(
            watershed,
            subbasin,
            comid,
            init_time)

        writer = csv_writer(response)
        writer.writerow(
            ['datetime', 'high_res (m3/s)', 'max (m3/s)', 'mean (m3/s)', 'min (m3/s)', 'std_dev_range_lower (m3/s)',
             'std_dev_range_upper (m3/s)'])

        for row_data in qout_data:
            writer.writerow(row_data.split(','))

        return response

    except Exception as e:
        print(str(e))
        return JsonResponse({'error': 'No forecast data found.'})
