/*global console, Ext, alert */
Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    mixins: ['Rally.Messageable'],
    items: [{
        xtype: 'container',
        itemId: 'chart_box'
    }],
    launch: function() {
        var that = this;
        this.wait = new Ext.LoadMask( Ext.getBody(), {msg: "Loading data..." } );
        this.team = {};
        this.key_prefix = "com.rallydev.pxs.hwyw.";
        this.subscribe( this.key_prefix, function( opt ) { 
            console.log( "Responding to published event", opt);
            that._getTeamMembers(); 
        } );
        this._getTeamMembers();
        
    },
    _getTeamMembers: function() {
        console.log( "_getTeamMembers()" );
        var the_team = {};
        var that = this;
        
        Rally.data.ModelFactory.getModel({
            type: 'Project',
            success: function(model) {
                if ( that.getContext() && that.getContext().getProject() ) {
	                model.load( that.getContext().getProject().ObjectID, {
	                    fetch: [ 'Name', 'TeamMembers', 'ObjectID', 'DisplayName' ],
	                    callback: function(result,operation) {
		                    if ( operation.wasSuccessful() ) {
	                            Ext.Array.each( result.data.TeamMembers, function( member ) {
	                                the_team[ member.ObjectID ] = member.DisplayName;
	                            });
	                            that.team = the_team;
	                            that._gatherEnergy();
		                    } else {
		                        alert( "Error saving:" + operation.error.errors[0] );
		                        console.log( "error", operation );
		                    }
	                    }
	                });
                }
            },
            scope: this
        });
    },
    _gatherEnergy: function() {
        console.log( "_gatherEnergy()" );
        this.wait.show();
        var go_back_to = Rally.util.DateTime.toIsoString( Rally.util.DateTime.add( new Date(), "month", -3 ) ).replace(/T[\W\w]*/,"");
                
        var key = this.key_prefix;
        Ext.create( 'Rally.data.WsapiDataStore', {
            model: 'Preference',
            listeners: {
                load: function( store, data, success ) {
                    this._processData( data );
                },
                scope: this
            },
            fetch: ['Name','Value','User','DisplayName','ObjectID'],
            filters: [{
                property: 'Name',
                operator: 'contains',
                value: key
            },
            {
                property: 'Name',
                operator: '>',
                value: key + go_back_to
            }],
            autoLoad: true
        });
    },
    _processData: function( data ) {
        console.log( "_processData", data );
        var chart_data = [];
        var data_hash = {};
        var that = this;
        
        Ext.Array.each( data, function( item ) {
            var pref = Ext.JSON.decode( item.data.Value );
            var name = item.data.Name;
            
            if ( ! item.data.User ) {
                var userID = name.replace(/[\W\w]*\./,"");
	            
                if ( that.team[userID] ) {
		            if ( ! data_hash[userID] ) { 
		                data_hash[userID] = {
		                    name: that.team[userID],
		                    data: []
		                };
		            }
		            var point = [ Rally.util.DateTime.fromIsoString( pref.date ).getTime(), pref.energy, pref.comment ];
		            data_hash[ userID ].data.push( point );
                }
            }
        });
        this.wait.hide();
        for ( var user in data_hash ) {
            if ( data_hash.hasOwnProperty(user) ) {
                chart_data.push( data_hash[user] );
            }
        }
        this._showChart( chart_data );
    },
    _showChart: function(data) {
        var that = this;
        
        console.log( that.getHeight(), that.getWidth() );
        if (this.chart) { this.chart.destroy(); }
        this.chart = Ext.create('Rally.ui.chart.Chart', {
            height: that.getHeight() - 20,
            width: that.getWidth() - 20,
            chartConfig: {
                chart: { 
                    type: 'line'
                },
                title: {
                    text: "How Was Our Week?",
                    align: "Center"
                },
                tooltip: {
                    formatter: function() {
                        return "<b>" + this.point.series.name + ": </b>" + this.point.config[1] + "<br/>" + this.point.config[2];
                    }
                },
                series: data,
                xAxis: { type: 'datetime' },
                yAxis: { minRange: 5, min: 1, tickInterval: 1, max: 5, title: { text: "Energy" }},
                exporting: { enableImages: true, enabled: true }
            }
        });
        this.down('#chart_box').add(this.chart);
    }
});
