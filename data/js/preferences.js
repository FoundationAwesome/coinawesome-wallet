/**
 * preferences.js
 * Copyright (c) 2014 Mr. Awesome
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the MIT license.
 *
 * Preferences handles storing and retrieving saved values
 */

(function(window) {

    var ADDRESS = "wallet.address",
        //TRANSACTIONS = "wallet.transactions",
        PRIVATE_KEY = "wallet.private_key",
        IS_ENCRYPTED = "wallet.is_encrypted",
        LAST_BALANCE = "wallet.last_balance",
        EXCHANGE_RATE = 'wallet.exchange_rate',
        AWE_UNITS = 'wallet.btc_units',
        CURRENCY = 'wallet.currency',
        preferences = function() {};

    function sync() {
        return new Promise(function(resolve) {
            // Different APIs for Chrome and Firefox
            if (typeof chrome !== 'undefined') {
                var object = {};
                object[ADDRESS] = '';
                //object[TRANSACTIONS] = '';
                object[PRIVATE_KEY] = '';
                object[IS_ENCRYPTED] = false;
                object[LAST_BALANCE] = 0;
                object[EXCHANGE_RATE] = 0;
                object[AWE_UNITS] = 'AWE';
                object[CURRENCY] = 'USD';
                // Changed from local to sync storage,
                // but need to make sure we keep previous users' sync data
                chrome.storage.sync.get(object, function(result) {
                    if (result[ADDRESS] === '') {
                        chrome.storage.local.get(object, function(syncResult) {
                            chrome.storage.sync.set(syncResult, function() {
                                resolve(syncResult);
                            });
                        });
                    } else {
                        resolve(result);
                    }
                });
            } else { // FIREFOX
                // util.message('get').then(function (message) {
                //     if (typeof message[PRIVATE_KEY] === 'undefined') {
                //         message[ADDRESS] = '';
                //         message[PRIVATE_KEY] = '';
                //         message[IS_ENCRYPTED] = false;
                //         message[LAST_BALANCE] = 0;
                //         message[EXCHANGE_RATE] = 0;
                //         message[AWE_UNITS] = 'AWE';
                //         message[CURRENCY] = 'USD';
                //         return util.message('save', message);
                //     } else {
                //         return message;
                //     }
                // }).then(function (message) {
                //     resolve(message);
                // });
            }
        });
    }

    function get(pref) {
        return function() {
            return sync().then(function(values) {
                return values[pref];
            });
        };
    };

    function set(key, value) {
        return new Promise(function(resolve) {
            var object = {};
            object[key] = value;
            // Different APIs for Chrome and Firefox
            if (typeof chrome !== 'undefined') {
                chrome.storage.sync.set(object, resolve);
            } else { // FIREFOX
                //util.message('save', object).then(resolve);
            }
        });
    };

    preferences.prototype = {

        getAddress: get(ADDRESS),
        setAddress: function(address) {
            //console.log('setting address')
            return set(ADDRESS, address);
        },

        // getTxs: get(ADDRESS),
        // setTxs: function(address) {
        //     console.log('setting transactions')
        //     return set(TRANSACTIONS, transactions);
        // },

        getPrivateKey: get(PRIVATE_KEY),
        setPrivateKey: function(privateKey) {
            return set(PRIVATE_KEY, privateKey);
        },

        getIsEncrypted: get(IS_ENCRYPTED),
        setIsEncrypted: function(isEncrypted) {
            return set(IS_ENCRYPTED, isEncrypted);
        },

        getLastBalance: get(LAST_BALANCE),
        setLastBalance: function(lastBalance) {
            return set(LAST_BALANCE, lastBalance);
        },

        getExchangeRate: get(EXCHANGE_RATE),
        setExchangeRate: function(exchangeRate) {
            return set(EXCHANGE_RATE, exchangeRate);
        },

        getAWEUnits: get(AWE_UNITS),
        setAWEUnits: function(btcUnits) {
            return set(AWE_UNITS, btcUnits);
        },

        getCurrency: get(CURRENCY),
        setCurrency: function(currency) {
            return set(CURRENCY, currency).then(function() {
                //currencyManager.updateExchangeRate();
            });
        }
    };

    window.preferences = new preferences();

})(window);