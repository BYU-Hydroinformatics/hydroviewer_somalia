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
                name='get_discharge_data',
                url='get-discharge-data',
                controller='hydroviewer_somalia.controllers.get_discharge_data'
            ),
            UrlMap(
                name='get_simulated_data',
                url='get-simulated-data',
                controller='hydroviewer_somalia.controllers.get_simulated_data'
            ),
            UrlMap(
                name='get_hydrographs',
                url='get-hydrographs',
                controller='hydroviewer_somalia.controllers.get_hydrographs'
            ),
            UrlMap(
                name='get_dailyAverages',
                url='get-dailyAverages',
                controller='hydroviewer_somalia.controllers.get_dailyAverages'
            ),
            UrlMap(
                name='get_monthlyAverages',
                url='get-monthlyAverages',
                controller='hydroviewer_somalia.controllers.get_monthlyAverages'
            ),
            UrlMap(
                name='get_scatterPlot',
                url='get-scatterPlot',
                controller='hydroviewer_somalia.controllers.get_scatterPlot'
            ),
            UrlMap(
                name='get_scatterPlotLogScale',
                url='get-scatterPlotLogScale',
                controller='hydroviewer_somalia.controllers.get_scatterPlotLogScale'
            ),
            UrlMap(
                name='get_volumeAnalysis',
                url='get-volumeAnalysis',
                controller='hydroviewer_somalia.controllers.get_volumeAnalysis'
            ),
            UrlMap(
                name='volume_table_ajax',
                url='volume-table-ajax',
                controller='hydroviewer_somalia.controllers.volume_table_ajax'
            ),
            UrlMap(
                name='make_table_ajax',
                url='make-table-ajax',
                controller='hydroviewer_somalia.controllers.make_table_ajax'
            ),
            UrlMap(
                name='get_observed_discharge_csv',
                url='get-observed-discharge-csv',
                controller='hydroviewer_somalia.controllers.get_observed_discharge_csv'
            ),
            UrlMap(
                name='get_simulated_discharge_csv',
                url='get-simulated-discharge-csv',
                controller='hydroviewer_somalia.controllers.get_simulated_discharge_csv'
            ),
        )

        return url_maps
