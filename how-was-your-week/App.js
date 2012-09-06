/*global console, Ext, alert */
Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    defaults: {
        padding: 5
    },
    mixins: ['Rally.Messageable'],
    items: [{
        xtype: 'rallydatefield',
        fieldLabel: '',
        itemId: 'date_box',
        listeners: {
            change: function( field, newValue, oldValue ) {
                this.ownerCt._loadValues();
            }
        }
    },
    {
        xtype: 'rallycombobox',
        itemId: 'energy_box',
        store: [
                       [ 5, "Super" ],
                       [ 4, "Pretty Good" ],
                       [ 3, "OK" ],
                       [ 2, "Little Low" ],
                       [ 1, "Blah" ]
               ]
    },
    {
        xtype: 'textarea',
        itemId: 'comment_box',
        size: 20,
        grow: true,
        growMin: 150,
        emptyText: 'Optional Comment ( <= 140 chars )',
        validator: function(value) {
            if ( value.length > 140 ) { 
                this.setValue( value.substring(0,140) );
                return "Limited to 140 characters"; 
            } else {
                return true;
            }
        },
        invalidText: "Limited to 140 characters"
    },
    {
        xtype: 'rallybutton',
        text: 'Save',
        margin: 5,
        handler: function() {
            this.ownerCt._saveValue();
        }
    }],

    launch: function() {
        console.log( this.getContext().getProject() );
        this.wait = new Ext.LoadMask( Ext.getBody(), {msg: "Loading data..." } );
        //console.log( Rally.environment );
        //this.bus = Rally.environment.getMessageBus();
        //console.log( this.bus );
        
        this.key_prefix = "com.rallydev.pxs.hwyw.";
        this.down('#date_box').setValue( new Date() );
        this.down('#energy_box').setValue( 3 );
    },
    _loadValues: function() {
        this.wait.show();
        var date_string = Rally.util.DateTime.toIsoString(this.down("#date_box").getValue(), true).replace(/T[\W\w]*/,"");
        var key = this.key_prefix + date_string + "." + this.getContext().getUser().ObjectID;
        Ext.create( 'Rally.data.WsapiDataStore', {
            model: 'Preference',
            listeners: {
                load: function( store, data, success ) {
                    if ( data.length > 0 ) {
                        this.preference = data[0].data;
                        var value = Ext.JSON.decode( this.preference.Value );
                        this.down("#energy_box").setValue( value.energy );
                        this.down("#comment_box").setValue( value.comment );
                    } else {
                        this.preference = null;
                        this.down("#energy_box").setValue( 3 );
                        this.down("#comment_box").setValue( "" );
                    }
                    this.wait.hide();
                },
                scope: this
            },
            fetch: ['Name','Value'],
            filters: [{
                property: 'Name',
                operator: '=',
                value: key
            }],
            autoLoad: true
        });
    },
    _saveValue: function() {
        var waiter = this.wait;
        waiter.show();
        var that = this;
        
        var date_string = Rally.util.DateTime.toIsoString(this.down("#date_box").getValue(), true).replace(/T[\W\w]*/,"");
        var value = {
            date:  date_string,
            energy: this.down("#energy_box").getValue(),
            comment: this.down("#comment_box").getValue()
        };
        var key = this.key_prefix + date_string + "." + this.getContext().getUser().ObjectID;
        console.log( value );
        if ( this.preference ) {
            var objectID = this.preference.ObjectID;
            
            Rally.data.ModelFactory.getModel({
                type: 'Preference',
                success: function(model) {
                    model.load( objectID, {
                        fetch: [ 'ObjectID' ],
                        callback: function(result,operation) {
                            if ( operation.wasSuccessful() ) {
                                result.set( 'Value', Ext.JSON.encode(value) );
                                result.save( {
					                callback: function( result, operation ) {
					                    if ( operation.wasSuccessful() ) {
				                            that.record = result;
                                            that.publish("com.rallydev.pxs.hwyw.", { text: "save" } );
				                        } else {
				                            alert( "Error saving:" + operation.error.errors[0] );
				                            console.log( "error", operation );
				                        }
                                        waiter.hide();
					                }
					            } );
                            } else {
                                alert( "Error getting:" + operation.error.errors[0] );
                                console.log( "error", operation );
                            }
                        }
                    });
                }
            });
            
        } else {
            Rally.data.ModelFactory.getModel({
                type: 'Preference',
                success: function( model) {
                    var record = Ext.create(model, {
                        Name: key,
                        Value: Ext.JSON.encode(value),
                        Project: this.getContext().getProject()
                    });
                    record.save({
                        callback: function(result,operation) {
                            if ( operation.wasSuccessful() ) {
                                that.preference = result;
                                that.publish("com.rallydev.pxs.hwyw.", { text: "save" } );
                            } else {
                                alert( "Error saving:" + operation.error.errors[0] );
                                console.log( "error", operation );
                            }
                            waiter.hide();
                        }, 
                        scope: this
                    });
                },
                scope: this
            });
        }
    }
});
