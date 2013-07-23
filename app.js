/**
 * Module dependencies.
 */

var express   = require('express')
  , http      = require('http')
  , path      = require('path')
  , partials  = require('express-partials')
  , config    = require('./config')
  , app       = express();

/**
 * Source: http://stackoverflow.com/a/7965071
 */
function mergeRecursive(obj1, obj2) {
    for (var p in obj2) {
        if (obj2.hasOwnProperty(p)) {
            obj1[p] = (typeof obj2[p] === 'object') ? mergeRecursive(obj1[p], obj2[p]) : obj2[p];
        }
    }
    return obj1;
}

// set config by environment
if (process.env.ENVIRONMENT!='default') {
    app.config = mergeRecursive(config.default, config[process.env.ENVIRONMENT]);
} else {
    app.config = config.default;
}

// setup socket io
global.io = require('socket.io').listen(app.listen( app.config.server.port ));
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
db.connect(app.config.db.service+'://'+app.config.db.host+'/'+app.config.db.database);

app.configure(function() {
	app.set('views', __dirname + '/views');
	app.set('view engine', 'ejs');
	app.set('view options', { layout:true, pretty: true });
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

