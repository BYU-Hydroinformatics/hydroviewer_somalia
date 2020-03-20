from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from tethys_sdk.gizmos import PlotlyView
from django.http import HttpResponse, JsonResponse

import pandas as pd
import io
import requests
import json
import ast
import numpy as np
import datetime as dt
import plotly.graph_objs as go
import hydrostats as hs
import hydrostats.data as hd
from HydroErr.HydroErr import metric_names, metric_abbr
import scipy.stats as sp
from scipy import integrate
import traceback
from csv import writer as csv_writer

def home(request):
    """
    Controller for the app home page.
    """

    context = {}

    return render(request, 'hydroviewer_somalia/home.html', context)

def get_available_dates(request):
    get_data = request.GET

    watershed = get_data['watershed']
    subbasin = get_data['subbasin']
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
        # model = get_data['model']
        watershed = get_data['watershed']
        subbasin = get_data['subbasin']
        comid = get_data['comid']
        if get_data['startdate'] != '':
            startdate = get_data['startdate']
        else:
            startdate = 'most_recent'
        units = 'metric'

        # request_params
        request_params = dict(watershed_name=watershed, subbasin_name=subbasin, reach_id=comid, forecast_folder=startdate, return_format='csv')

        # Token is for the demo account
        request_headers = dict(Authorization='Token 1adf07d983552705cd86ac681f3717510b6937f6')

        res = requests.get('https://tethys2.byu.edu/apps/streamflow-prediction-tool/api/GetForecast/',
                           params=request_params, headers=request_headers)

        pairs = res.content.splitlines()
        header = pairs.pop(0)

        dates = []
        hres_dates = []

        mean_values = []
        hres_values = []
        min_values = []
        max_values = []
        std_dev_lower_values = []
        std_dev_upper_values = []

        for pair in pairs:
            pair = pair.decode('utf-8')
            if b'high_res' in header:
                hres_dates.append(dt.datetime.strptime(pair.split(',')[0], '%Y-%m-%d %H:%M:%S'))
                hres_values.append(float(pair.split(',')[1]))

                if 'nan' not in pair:
                    dates.append(dt.datetime.strptime(pair.split(',')[0], '%Y-%m-%d %H:%M:%S'))
                    max_values.append(float(pair.split(',')[2]))
                    mean_values.append(float(pair.split(',')[3]))
                    min_values.append(float(pair.split(',')[4]))
                    std_dev_lower_values.append(float(pair.split(',')[5]))
                    std_dev_upper_values.append(float(pair.split(',')[6]))

            else:
                dates.append(dt.datetime.strptime(pair.split(',')[0], '%Y-%m-%d %H:%M:%S'))
                max_values.append(float(pair.split(',')[1]))
                mean_values.append(float(pair.split(',')[2]))
                min_values.append(float(pair.split(',')[3]))
                std_dev_lower_values.append(float(pair.split(',')[4]))
                std_dev_upper_values.append(float(pair.split(',')[5]))

        # ----------------------------------------------
        # Chart Section
        # ----------------------------------------------

        datetime_start = dates[0]
        datetime_end = dates[-1]

        avg_series = go.Scatter(
            name='Mean',
            x=dates,
            y=mean_values,
            line=dict(
                color='blue',
            )
        )

        max_series = go.Scatter(
            name='Max',
            x=dates,
            y=max_values,
            fill='tonexty',
            mode='lines',
            line=dict(
                color='rgb(152, 251, 152)',
                width=0,
            )
        )

        min_series = go.Scatter(
            name='Min',
            x=dates,
            y=min_values,
            fill=None,
            mode='lines',
            line=dict(
                color='rgb(152, 251, 152)',
            )
        )

        std_dev_lower_series = go.Scatter(
            name='Std. Dev. Lower',
            x=dates,
            y=std_dev_lower_values,
            fill='tonexty',
            mode='lines',
            line=dict(
                color='rgb(152, 251, 152)',
                width=0,
            )
        )

        std_dev_upper_series = go.Scatter(
            name='Std. Dev. Upper',
            x=dates,
            y=std_dev_upper_values,
            fill='tonexty',
            mode='lines',
            line=dict(
                width=0,
                color='rgb(34, 139, 34)',
            )
        )

        plot_series = [min_series,
                       std_dev_lower_series,
                       std_dev_upper_series,
                       max_series,
                       avg_series]

        if hres_values:
            plot_series.append(go.Scatter(
                name='HRES',
                x=hres_dates,
                y=hres_values,
                line=dict(
                    color='black',
                )
            ))

        try:
            return_shapes, return_annotations = get_return_period_ploty_info(request, datetime_start, datetime_end)
        except:
            return_annotations = []
            return_shapes = []

        layout = go.Layout(
            title="Forecast<br><sub>{0} ({1}): {2}</sub>".format(
                watershed, subbasin, comid),
            xaxis=dict(
                title='Date',
            ),
            yaxis=dict(
                title='Streamflow ({}<sup>3</sup>/s)'.format(get_units_title(units)),
                range=[0, max(max_values) + max(max_values)/5]
            ),
            shapes=return_shapes,
            annotations=return_annotations
        )

        chart_obj = PlotlyView(
            go.Figure(data=plot_series,
                      layout=layout)
        )

        context = {
            'gizmo_object': chart_obj,
        }

        return render(request, 'hydroviewer_somalia/gizmo_ajax.html', context)

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

        watershed = request.GET.get('watershed')
        subbasin = request.GET.get('subbasin')
        comid = request.GET.get('comid')
        date = request.GET.get('startdate')
        if date == '':
            forecast = 'most_recent'
        else:
            forecast = str(date)

        # request_params
        request_params = dict(watershed_name=watershed, subbasin_name=subbasin, reach_id=comid, forecast_folder=forecast)

        # Token is for the demo account
        request_headers = dict(Authorization='Token 1adf07d983552705cd86ac681f3717510b6937f6')

        ens = requests.get('https://tethys2.byu.edu/apps/streamflow-prediction-tool/api/GetEnsemble/',
                               params=request_params, headers=request_headers)

        request_params1 = dict(watershed_name=watershed, subbasin_name=subbasin, reach_id=comid)

        rpall = requests.get('https://tethys2.byu.edu/apps/streamflow-prediction-tool/api/GetReturnPeriods/',
                           params=request_params1, headers=request_headers)

        dicts = ens.content.splitlines()
        dictstr = []

        rpdict = ast.literal_eval(rpall.content.decode('utf-8'))
        rpdict.pop('max', None)

        rivperc = {}
        riverpercent = {}
        rivpercorder = {}

        for q in rpdict:
            rivperc[q] = {}
            riverpercent[q] = {}

        dictlen = len(dicts)
        for i in range(1, dictlen):
            dictstr.append(dicts[i].decode('utf-8').split(","))

        for rps in rivperc:
            rp = float(rpdict[rps])
            for b in dictstr:
                date = b[0][:10]
                if date not in rivperc[rps]:
                    rivperc[rps][date] = []
                length = len(b)
                for x in range(1, length):
                    flow = float(b[x])
                    if x not in rivperc[rps][date] and flow > rp:
                        rivperc[rps][date].append(x)
            for e in rivperc[rps]:
                riverpercent[rps][e] = float(len(rivperc[rps][e])) / 51.0 * 100

        for keyss in rivperc:
            data = riverpercent[keyss]
            ordered_data = sorted(list(data.items()), key=lambda x: dt.datetime.strptime(x[0], '%Y-%m-%d'))
            rivpercorder[keyss] = ordered_data

        rivdates = []
        rivperctwo = []
        rivpercten = []
        rivperctwenty = []

        for a in rivpercorder['two']:
            rivdates.append(a[0])
            rivperctwo.append(a[1])

        for s in rivpercorder['ten']:
            rivpercten.append(s[1])

        for d in rivpercorder['twenty']:
            rivperctwenty.append(d[1])

        formatteddates = [str(elem)[-4:] for elem in rivdates]
        formattedtwo = ["%.0f" % elem for elem in rivperctwo]
        formattedten = ["%.0f" % elem for elem in rivpercten]
        formattedtwenty = ["%.0f" % elem for elem in rivperctwenty]

        formatteddates = formatteddates[:len(formatteddates) - 5]
        formattedtwo = formattedtwo[:len(formattedtwo) - 5]
        formattedten = formattedten[:len(formattedten) - 5]
        formattedtwenty = formattedtwenty[:len(formattedtwenty) - 5]

        dataformatted = {'percdates': formatteddates, 'two': formattedtwo, 'ten': formattedten,
                         'twenty': formattedtwenty}

        return JsonResponse(dataformatted)


def get_historic_data(request):
    """
    Get simulated data from api
    """

    try:
        get_data = request.GET
        watershed = get_data['watershed']
        subbasin = get_data['subbasin']
        comid = get_data['comid']
        units = 'metric'

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

        # ----------------------------------------------
        # Chart Section
        # --------------------------------------
        era_series = go.Scatter(
            name='ERA Interim',
            x=era_dates,
            y=era_values,
        )

        return_shapes, return_annotations = get_return_period_ploty_info(request, era_dates[0], era_dates[-1])

        layout = go.Layout(
            title="Historical Streamflow<br><sub>{0} ({1}): {2}</sub>".format(
                watershed, subbasin, comid),
            xaxis=dict(
                title='Date',
            ),
            yaxis=dict(
                title='Streamflow ({}<sup>3</sup>/s)'
                    .format(get_units_title(units))
            ),
            shapes=return_shapes,
            annotations=return_annotations
        )

        chart_obj = PlotlyView(
            go.Figure(data=[era_series],
                      layout=layout)
        )

        context = {
            'gizmo_object': chart_obj,
        }

        return render(request, 'hydroviewer_somalia/gizmo_ajax.html', context)

    except Exception as e:
        print(str(e))
        return JsonResponse({'error': 'No simulated data found for the selected station.'})

def get_flow_duration_curve(request):
    get_data = request.GET

    try:
        watershed = get_data['watershed']
        subbasin = get_data['subbasin']
        comid = get_data['comid']
        units = 'metric'

        # request_params
        request_params = dict(watershed_name=watershed, subbasin_name=subbasin, reach_id=comid, return_format='csv')

        # Token is for the demo account
        request_headers = dict(Authorization='Token 1adf07d983552705cd86ac681f3717510b6937f6')

        era_res = requests.get('https://tethys2.byu.edu/apps/streamflow-prediction-tool/api/GetHistoricData/',
                               params=request_params, headers=request_headers)

        era_pairs = era_res.content.splitlines()
        era_pairs.pop(0)

        era_values = []

        for era_pair in era_pairs:
            era_pair = era_pair.decode('utf-8')
            era_values.append(float(era_pair.split(',')[1]))

        sorted_daily_avg = np.sort(era_values)[::-1]

        # ranks data from smallest to largest
        ranks = len(sorted_daily_avg) - sp.rankdata(sorted_daily_avg,
                                                    method='average')

        # calculate probability of each rank
        prob = [100*(ranks[i] / (len(sorted_daily_avg) + 1))
                for i in range(len(sorted_daily_avg))]

        flow_duration_sc = go.Scatter(
            x=prob,
            y=sorted_daily_avg,
        )

        layout = go.Layout(title="Flow-Duration Curve<br><sub>{0} ({1}): {2}</sub>"
                                 .format(watershed, subbasin, comid),
                           xaxis=dict(
                               title='Exceedance Probability (%)',),
                           yaxis=dict(
                               title='Streamflow ({}<sup>3</sup>/s)'
                                     .format(get_units_title(units)),
                               type='log',
                               autorange=True),
                           showlegend=False)

        chart_obj = PlotlyView(
            go.Figure(data=[flow_duration_sc],
                      layout=layout)
        )

        context = {
            'gizmo_object': chart_obj,
        }

        return render(request, 'hydroviewer_somalia/gizmo_ajax.html', context)

    except Exception as e:
        print(str(e))
        return JsonResponse({'error': 'No historic data found for calculating flow duration curve.'})

def get_dailyAverages(request):
    """
    Get historic simulations from ERA Interim
    """
    get_data = request.GET

    try:
        watershed = get_data['watershed']
        subbasin = get_data['subbasin']
        comid = get_data['comid']
        units = 'metric'

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

        historic_df = pd.DataFrame(data=era_values, index=era_dates, columns=['Historical Streamflow'])

        daily_avg = historic_df.groupby(historic_df.index.strftime("%m/%d")).mean()
        daily_min = historic_df.groupby(historic_df.index.strftime("%m/%d")).min()
        daily_max = historic_df.groupby(historic_df.index.strftime("%m/%d")).max()

        # ----------------------------------------------
        # Chart Section
        # --------------------------------------


        avg_series = go.Scatter(
            name='Mean',
            x=daily_avg.index.tolist(),
            y=daily_avg.iloc[:, 0].values.tolist(),
            line=dict(
                color='blue',
            )
        )

        max_series = go.Scatter(
            name='Max',
            x=daily_max.index.tolist(),
            y=daily_max.iloc[:, 0].values.tolist(),
            fill='tonexty',
            mode='lines',
            line=dict(
                color='rgb(152, 251, 152)',
                width=0,
            )
        )

        min_series = go.Scatter(
            name='Min',
            x=daily_min.index.tolist(),
            y=daily_min.iloc[:, 0].values.tolist(),
            fill=None,
            mode='lines',
            line=dict(
                color='rgb(152, 251, 152)',
            )
        )

        plot_series = [min_series,
                       max_series,
                       avg_series]

        layout = go.Layout(
            title="Daily Seasonality <br><sub>{0} ({1}): {2}</sub>".format(
                watershed, subbasin, comid),
            xaxis=dict(
                title='Date',
            ),
            yaxis=dict(
                title='Streamflow ({}<sup>3</sup>/s)'.format(get_units_title(units))
            ),
        )

        chart_obj = PlotlyView(
            go.Figure(data=plot_series,
                      layout=layout)
        )

        context = {
            'gizmo_object': chart_obj,
        }

        return render(request, 'hydroviewer_somalia/gizmo_ajax.html', context)

    except Exception as e:
        print(str(e))
        return JsonResponse({'error': 'No data found for the selected station.'})

def get_monthlyAverages(request):
    """
    Get historic simulations from ERA Interim
    """
    get_data = request.GET

    try:
        watershed = get_data['watershed']
        subbasin = get_data['subbasin']
        comid = get_data['comid']
        units = 'metric'

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

        historic_df = pd.DataFrame(data=era_values, index=era_dates, columns=['Historical Streamflow'])

        monthly_avg = historic_df.groupby(historic_df.index.strftime("%m")).mean()
        monthly_min = historic_df.groupby(historic_df.index.strftime("%m")).min()
        monthly_max = historic_df.groupby(historic_df.index.strftime("%m")).max()

        # ----------------------------------------------
        # Chart Section
        # --------------------------------------

        avg_series = go.Scatter(
            name='Mean',
            x=monthly_avg.index.tolist(),
            y=monthly_avg.iloc[:, 0].values.tolist(),
            line=dict(
                color='blue',
            )
        )

        max_series = go.Scatter(
            name='Max',
            x=monthly_max.index.tolist(),
            y=monthly_max.iloc[:, 0].values.tolist(),
            fill='tonexty',
            mode='lines',
            line=dict(
                color='rgb(152, 251, 152)',
                width=0,
            )
        )

        min_series = go.Scatter(
            name='Min',
            x=monthly_min.index.tolist(),
            y=monthly_min.iloc[:, 0].values.tolist(),
            fill=None,
            mode='lines',
            line=dict(
                color='rgb(152, 251, 152)',
            )
        )

        plot_series = [min_series,
                       max_series,
                       avg_series]

        layout = go.Layout(
            title="Monthly Seasonality <br><sub>{0} ({1}): {2}</sub>".format(
                watershed, subbasin, comid),
            xaxis=dict(
                title='Date',
            ),
            yaxis=dict(
                title='Streamflow ({}<sup>3</sup>/s)'.format(get_units_title(units))
            ),
        )

        chart_obj = PlotlyView(
            go.Figure(data=plot_series,
                      layout=layout)
        )

        context = {
            'gizmo_object': chart_obj,
        }

        return render(request, 'hydroviewer_somalia/gizmo_ajax.html', context)

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

        era_res = requests.get('https://tethys2.byu.edu/apps/streamflow-prediction-tool/api/GetHistoricData/', params=request_params, headers=request_headers)

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
        response['Content-Disposition'] = 'attachment; filename=streamflow_forecast_{0}_{1}_{2}_{3}.csv'.format(watershed,
                                                                                                                subbasin,
                                                                                                                comid,
                                                                                                                init_time)

        writer = csv_writer(response)
        writer.writerow(['datetime', 'high_res (m3/s)', 'max (m3/s)', 'mean (m3/s)', 'min (m3/s)', 'std_dev_range_lower (m3/s)',
                         'std_dev_range_upper (m3/s)'])

        for row_data in qout_data:
            writer.writerow(row_data.split(','))

        return response

    except Exception as e:
        print(str(e))
        return JsonResponse({'error': 'No forecast data found.'})