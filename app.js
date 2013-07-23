/**
 * Module dependencies.
 */

var express   = require('express')
  , http      = require('http')
  , path      = require('path')
  , partials  = require('express-partials')
  , config    = require('./config')
  , app       = express();

global.io = require('socket.io').listen(app.listen( config.port ));

io.configure(function () {
	io.set('transports', ['websocket', 'xhr-polling']);
	io.set('log level', config.log_level);
	io.set('force new connection', true);
});

io.sockets.on('connection', function (socket)
{
	socket.on('setMaxThreads', function(data){  });
});

// db connect
var db = require('mongoose');
db.connect(config.db.service+'://'+config.db.host+'/'+config.db.database);

app.configure(function() {
	app.set('views', __dirname + '/views');
	app.set('view engine', 'ejs');
	app.set('view options', { layout:true, pretty: true });
	app.set('config', config);
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

