/**
 * Module dependencies.
 */

var express    = require('express')
  , http       = require('http')
  , path       = require('path')
  , partials   = require('express-partials')
  , underscore = require('underscore')
  , config     = require('./config')
  , app        = express();

// set config by environment
if (process.env.ENVIRONMENT!='default') {
    app.config = underscore.extend(config.default, config[process.env.ENVIRONMENT]);
} else {
    app.config = config.default;
}

// setup socket io
global.io = require('socket.io').listen(app.listen( app.config.server.port ));

io.sockets.on('connection', function (socket) {
	// @TODO: Implement setting of max threads
	socket.on('setMaxThreads', function (data) {});
});

// db connect
var db = require('mongoose');
db.connect(app.config.db.service+'://'+app.config.db.host+'/'+app.config.db.database);

app.configure(function() {
	app.set('views', __dirname + '/views');
	app.set('view engine', 'ejs');
	app.set('view options', { layout: true, pretty: true });
	app.set('config', app.config);
	app.set('db', db);
	app.use(express.favicon());
	app.use(express.logger('dev'));
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(partials());
	app.use(app.router);
	app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
	app.use(express.errorHandler());
});

require('./routes')(app);

