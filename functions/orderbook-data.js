const https         = require('https');
const fs            = require('fs');

/*
  },
  {
    "name": "BitStamp",
    "url": "https://www.bitstamp.net/api/v2/order_book/ethbtc/",
    "markets": []

*/

function OrderBookData()
{

    try
    {
        this.sourcesConfig = fs.readFileSync(__dirname + '/config/orderbook-sources.json');
        this.orderBookSources = [];
        if (this.sourcesConfig.length)
        {
            this.orderBookSources = JSON.parse(this.sourcesConfig);
            console.log('Order Book Data loaded '+this.orderBookSources.length+' sources');
        }
    }
    catch (e)
    {
        console.error('Failed to load Order Book Sources',e);
    }

}

OrderBookData.prototype._flattenSet = (exchange,dataset) => {
    let flattenedSet = [];
    dataset.forEach((set)=>{
        flattenedSet.push({ exchg: exchange, rate: set[0], qty: set[1] });
    });
    return flattenedSet;
};

OrderBookData.prototype.flattenOrderBookData = function (rawData) {
    let self = this;
    return new Promise((resolve, reject)=> {
        let flattenedData = { bids: [], asks: [] };
        rawData.forEach((exchangeData) => {
            flattenedData.asks = flattenedData.asks.concat(self._flattenSet(exchangeData.source,exchangeData.data.asks));
            flattenedData.bids = flattenedData.bids.concat(self._flattenSet(exchangeData.source,exchangeData.data.bids));
        });
        flattenedData.asks.sort(self._rateSort);
        flattenedData.bids.sort(self._rateSort);
        resolve(flattenedData);
    });
};

OrderBookData.prototype.buildGraphRateData = function(rateData) {
    let avgRedux = (acc,vc)=>{ return (acc + vc)/2; },
        sumRedux = (acc,vc)=>{ return acc + vc; },
        redux = Math.floor(rateData.length/30),
        rateResult = [],
        rates = [],
        qtys = [],
        exchgs = [],
        exchangeData = [];
    let factor = Math.pow(10, 7);

    rateData.forEach((v,i)=>{
        try {
            let maxDecimal = v.rate.toString().split(".")[1].length || 0;
            if (i % redux === 0 || i === rateData.length-1)
            {
                console.info('averaged '+rates.length+' records');
                if (rates.length && qtys.length)
                {
                    rateResult.push({
                        avgRate: Math.round(rates.reduce(avgRedux) * factor) / factor,
                        totalQty: qtys.reduce(sumRedux),
                        exchanges: exchgs.join(','),
                        exchangeData: exchangeData
                    });
                    rates = [];
                    qtys = [];
                    exchgs = [];
                    exchangeData = [];
                }
            }
            else
            {
                exchangeData.push(v);
                rates.push(parseFloat(v.rate));
                qtys.push(v.qty);
                if (exchgs.indexOf(v.exchg) === -1) exchgs.push(v.exchg);
            }
        }
        catch (e)
        {
            console.error('failed',e);
        }
    });
    return rateResult;
};

OrderBookData.prototype.buildGraphData = function(flatData) {
    let self = this;
    return new Promise((resolve, reject)=> {

        try
        {
            resolve({ bids: self.buildGraphRateData(flatData.bids), asks: self.buildGraphRateData(flatData.asks) });
        }
        catch (e)
        {
            reject(e);
        }

    });
};

OrderBookData.prototype.fetchOrderBookData = function() {
    let self = this;
    return new Promise((resolve, reject)=>{
        let sourcesToFetch = [];
        console.log('sources... ',self.orderBookSources);
        self.orderBookSources.forEach(function(src){
            sourcesToFetch.push(self._fetchFromSource(src));
        });
        console.log('fetching from '+sourcesToFetch.length+' sources...');
        Promise.all(sourcesToFetch).then((results)=>{
            let data = [];
            results.forEach(function(res,i){
                res = JSON.parse(res);
                console.log('processing result '+self.orderBookSources[i].name);
                let fds = { source: self.orderBookSources[i].name, data: [] };
                if (self.orderBookSources[i].name === 'Bittrex')
                {
                    let normalizedData = { asks: [], bids: [] };
                    res.result.buy.forEach(function(rec){
                        normalizedData.bids.push([ rec.Rate.toString(), rec.Quantity ]);
                    });
                    res.result.sell.forEach(function(rec){
                        normalizedData.asks.push([ rec.Rate.toString(), rec.Quantity ]);
                    });
                    fds.data = normalizedData;
                }
                else
                {
                    fds.data = res;
                }

                data.push(fds);
            });
            resolve(data);
        },reject);
    });
};

OrderBookData.prototype._fetchFromSource = (source) => {

    let result = '';
    return new Promise((resolve,reject)=>{
        console.log('fetching data for '+source.name);
        https.get(source.url, (res) => {

            res.on('data', (d) => {
                result += d;
            });
            res.on('end',() => {
                resolve(result);
            });

        }).on('error', (e) => {
            reject('fetch for bittrex failed: '+e);
            console.error('fetch for bittrex failed: '+e);
        });
    });

};

OrderBookData.prototype._rateSort = (a,b) => {
    if (a.rate > b.rate) {
        return 1;
    } else if (a.rate < b.rate) {
        return -1;
    }
    return 0;
};

module.exports = new OrderBookData();
