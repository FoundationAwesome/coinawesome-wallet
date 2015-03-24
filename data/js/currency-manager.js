/**
 * currency-manager.js
 * Copyright (c) 2014 Mr. Awesome
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the MIT license.
 *
 * Currency manager handles the exchange rate of the currency
 * and the proper formatting of the currency value
 */

(function(window) {
    var currencyManager = function() {};
    currencyManager.prototype = {

        updateExchangeRate: function() {
            return preferences.getCurrency().then(function(currency) {
                return util.getJSON('https://api.bitcoinaverage.com/ticker/' + currency);
            }).then(function(response) {
                return preferences.setExchangeRate(response['24h_avg']);
            });
        },

        getSymbol: function() {
            return preferences.getCurrency().then(function(currency) {
                switch (currency) {
                    case 'AUD':
                    case 'CAD':
                    case 'NZD':
                    case 'SGD':
                    case 'USD':
                        return (['$', 'before']);
                    case 'BRL':
                        return (['R$', 'before']);
                    case 'CHF':
                        return ([' Fr.', 'after']);
                    case 'CNY':
                    case 'JPY':
                        return (['¥', 'before']);
                    case 'CZK':
                        return ([' Kč', 'after']);
                    case 'EUR':
                        return (['€', 'before']);
                    case 'GBP':
                        return (['£', 'before']);
                    case 'ILS':
                        return (['₪', 'before']);
                    case 'NOK':
                    case 'SEK':
                        return ([' kr', 'after']);
                    case 'PLN':
                        return (['zł', 'after']);
                    case 'RUB':
                        return ([' RUB', 'after']);
                    case 'ZAR':
                        return ([' R', 'after']);
                    default:
                        return (['$', 'before']);
                }
            });
        },

        getAvailableCurrencies: function() {
            return ['AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'EUR', 'GBP', 'ILS', 'JPY', 'NOK', 'NZD', 'PLN', 'RUB', 'SEK', 'SGD', 'USD', 'ZAR'];
        },

        formatAmount: function(value) {
            return Promise.all([preferences.getExchangeRate(), this.getSymbol()]).then(function(values) {
                var rate = values[0],
                    symbol = values[1][0],
                    beforeOrAfter = values[1][1],
                    SATOSHIS = 100000000,
                    text = (value / SATOSHIS * rate).formatMoney(2);
                if (beforeOrAfter === 'before') {
                    text = symbol + text;
                } else {
                    text += symbol;
                }
                return text;
            });
        }
    };

    Number.prototype.formatMoney = function(c, d, t) {
        var n = this,
            c = isNaN(c = Math.abs(c)) ? 2 : c,
            d = d == undefined ? "." : d,
            t = t == undefined ? "," : t,
            s = n < 0 ? "-" : "",
            i = parseInt(n = Math.abs(+n || 0).toFixed(c)) + "",
            j = (j = i.length) > 3 ? j % 3 : 0;
        return s + (j ? i.substr(0, j) + t : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + t) + (c ? d + Math.abs(n - i).toFixed(c).slice(2) :
            "");
    };

    //var ret = new currencyManager();
    //ret.updateExchangeRate();
    //window.currencyManager = ret;

})(window);