const functions     = require('firebase-functions');
const express       = require('express');
const exphbs        = require('express-handlebars');

const obd           = require('./orderbook-data');
const hbshalp       = require('./hbs-helpers');

const app = express();
const hbs = exphbs.create({ defaultLayout: 'index', helpers: hbshalp });

app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');

app.get('/',(request, response) => {
    //response.set("Cache-Control","public, max-age=300, s-maxage=600");
    obd.fetchOrderBookData().then((data)=>{
        obd.flattenOrderBookData(data).then((flattenedData)=> {
            obd.buildGraphData(flattenedData).then((graphData)=> {
                response.render('data-view', {graphData: graphData, data: flattenedData, dump: JSON.stringify(flattenedData)});
            });
        });
    },(e)=>{
        response.send("Error occurred while rendering data: "+e);
    });
});

app.get('/raw.json',(request, response) => {
    //response.set("Cache-Control","public, max-age=300, s-maxage=600");
    obd.fetchOrderBookData().then((data)=>{
        response.send(JSON.stringify(data));
    },(e)=>{
        response.send("Error occurred while rendering data: "+e);
    });
});

exports.app = functions.https.onRequest(app);
