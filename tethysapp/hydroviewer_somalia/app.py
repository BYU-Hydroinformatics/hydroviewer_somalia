from tethys_sdk.base import TethysAppBase, url_map_maker


class HydroviewerSomalia(TethysAppBase):
    """
    Tethys app class for Hydroviewer Somalia.
    """

    name = 'Hydroviewer Somalia'
    index = 'hydroviewer_somalia:home'
    icon = 'hydroviewer_somalia/images/hydroviewer_somalia.png'
    package = 'hydroviewer_somalia'
    root_url = 'hydroviewer-somalia'
    color = '#002255'
    description = ''
    tags = ''
    enable_feedback = False
    feedback_emails = []

    def url_maps(self):
        """
        Add controllers
        """
        UrlMap = url_map_maker(self.root_url)

        url_maps = (
            UrlMap(
                name='home',
                url='hydroviewer-somalia',
                controller='hydroviewer_somalia.controllers.home'
            ),
            UrlMap(
                name='get-available-dates',
                url='get-available-dates',
                controller='hydroviewer_somalia.controllers.get_available_dates'),
            UrlMap(
                name='get-time-series',
                url='get-time-series',
                controller='hydroviewer_somalia.controllers.get_time_series'),
            UrlMap(
                name='get-return-periods',
                url='get-return-periods',
                controller='hydroviewer_somalia.controllers.get_return_periods'),
            UrlMap(
                name='get-historic-data',
                url='get-historic-data',
                controller='hydroviewer_somalia.controllers.get_historic_data'),
            UrlMap(
                name='get_dailyAverages',
                url='get-dailyAverages',
                controller='hydroviewer_somalia.controllers.get_dailyAverages'),
            UrlMap(
                name='get_monthlyAverages',
                url='get-monthlyAverages',
                controller='hydroviewer_somalia.controllers.get_monthlyAverages'),
            UrlMap(
                name='get-flow-duration-curve',
                url='get-flow-duration-curve',
                controller='hydroviewer_somalia.controllers.get_flow_duration_curve'),
            UrlMap(
                name='get_historic_data_csv',
                url='get-historic-data-csv',
                controller='hydroviewer_somalia.controllers.get_historic_data_csv'),
            UrlMap(
                name='get_forecast_data_csv',
                url='get-forecast-data-csv',
                controller='hydroviewer_somalia.controllers.get_forecast_data_csv'),
            UrlMap(
                name='forecastpercent',
                url='forecastpercent',
                controller='hydroviewer_somalia.controllers.forecastpercent'),
        )

        return url_maps
