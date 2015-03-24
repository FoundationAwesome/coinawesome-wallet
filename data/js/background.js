/**
 * background.js
 * Copyright (c) 2014 Mr. Awesome
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the MIT license.
 *
 *  Background script for Chrome extension
 */

(function() {

    // Save port to communicate with content scripts
    var responsePort = null;
    chrome.runtime.onConnect.addListener(function(port) {
        responsePort = port;
    });

    // Create context menus
    // chrome.contextMenus.create({
    //     'title': 'Send to %s',
    //     'contexts': ['selection'],
    //     'onclick': menuOnClick
    // });
    //chrome.contextMenus.create({'title': 'Send AWE', 'contexts': ['page'], 'onclick': menuOnClick});
    function menuOnClick(info) {
        if (info.selectionText) {
            responsePort.postMessage({
                'address': info.selectionText
            });
        } else {
            responsePort.postMessage({});
        }
    };

    // Open new tabs
    chrome.runtime.onMessage.addListener(function(request) {
        if (request.address) {
            chrome.tabs.create({
                url: 'http://blockchain.coinawesome.com/api/addr/' + request.address
            });
        }
    })

})();