/**
 * util.js
 * Copyright (c) 2014 Mr. Awesome
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the MIT license.
 *
 * Utility methods
 */

(function(window) {
    var util = function() {},
        // Promisified ajax request
        request = function(url, type, data) {
            return new Promise(function(resolve, reject) {
                var req = new XMLHttpRequest();
                req.open((type ? type : 'GET'), url, true);
                req.onload = function() {
                    if (req.status == 200) {
                        resolve(req.response);
                    } else {
                        reject(Error(req.response));
                    }
                }
                req.onerror = function() {
                    reject(Error('Network error'));
                }
                if (type === 'POST') {
                    req.setRequestHeader('Content-type',
                        'application/x-www-form-urlencoded')
                }
                req.send(data);
            });
        };

    util.prototype = {
        getJSON: function(url) {
            if (typeof chrome !== 'undefined') {
                return request(url).then(JSON.parse);
            } else {
                return ret.message('getJSON', url);
            }
        },

        get: function(url) {
            return request(url);
        },

        post: function(url, data) {
            if (typeof chrome !== 'undefined') {
                return request(url, 'POST', data);
            } else {
                return ret.message('post', {
                    url: url,
                    content: data
                });
            }
        },

        // Used to send messages from content scripts to add-on scripts and return values to content scripts in Firefox add-on
        message: function(name, value) {
            return new Promise(function(resolve) {
                // 'self' can also be 'addon' depending on how script is injected
                var ref = (typeof addon === 'undefined' ? self : addon);
                ref.port.on(name, resolve);
                ref.port.emit(name, value);
            })
        }
    }

    var ret = new util()


    function fib(n, undefined) {
        if (fib.cache[n] === undefined)
            fib.cache[n] = fib(n - 1) + fib(n - 2)
        return fib.cache[n]
    }
    fib.cache = [0, 1, 1]

    util.prototype.fib = fib

    util.prototype.valAddr = function(href) {
        var address = false
        if (/^awesome:[A][1-9A-HJ-NP-Za-km-z]{26,33}/.test(href) // TODO remove external programm hint
            || /^[A][1-9A-HJ-NP-Za-km-z]{26,33}/.test(href)) {
            var addresses = href.match(/[A][1-9A-HJ-NP-Za-km-z]{26,33}/);
            var address = false;
            if (addresses) {
                address = addresses[0];
                // Check if the address is actually valid
                try {
                    new Bitcoin.Address.fromBase58Check(address);
                } catch (e) {
                    address = false;
                    return false
                }
            }
            // var amounts = href.match(/amount=\d+\.?\d*/);
            // var amount = null;
            // if (amounts) {
            //     amount = Number(amounts[0].substring(7)) * SATOSHIS;
            // }
            return address
        }
    }
    util.prototype.replaceTextOnPage = function(from, to) {
        getAllTextNodes().forEach(function(node) {
            node.nodeValue = node.nodeValue.replace(new RegExp(quote(from), 'g'), to);
        });

        function getAllTextNodes() {
            var result = [];

            (function scanSubTree(node) {
                if (node.childNodes.length)
                    for (var i = 0; i < node.childNodes.length; i++)
                        scanSubTree(node.childNodes[i]);
                else if (node.nodeType == Node.TEXT_NODE)
                    result.push(node);
            })(document);

            return result;
        }

        function quote(str) {
            return (str + '').replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
        }
    }

    util.prototype.iframe = function(src, appendTo) {
        return new Promise(function(resolve) {
            //console.log(appendTo)
            var iframe = document.createElement('iframe');
            if (appendTo) {
                $(appendTo).append(iframe)
            } else {
                document.body.appendChild(iframe);
            }
            iframe.setAttribute('style',
                'background-color: transparent; position: absolute; z-index: 2147483647; border: 0px;'
            );
            iframe.setAttribute('allowtransparency', 'true');
            iframe.frameBorder = '0';

            // Different workarounds to inject content into iFrames for Chrome and Firefox
            if (typeof chrome !== 'undefined') {
                // For Chrome get the HTML content with an ajax call and write it into the document
                iframe.src = 'about:blank';
                var request = new XMLHttpRequest();
                request.open('GET', chrome.extension.getURL('data/' + src), false);
                request.send(null);
                var text = request.response;
                // Replace css relative locations with absolute locations since Chrome won't find relative
                text = text.replace(/css\//g, chrome.extension.getURL('') + 'data/css/');
                iframe.contentWindow.document.open('text/html', 'replace');
                iframe.contentWindow.document.write(text);
                iframe.contentWindow.document.close();
                resolve(iframe);
            } else {
                // For Firefox get the encoded HTML and set it to the iFrame's src
                ret.message('html', src).then(function(url) {
                    iframe.src = url;
                    // Only way to reliably know when the frame is ready in Firefox is by polling
                    function pollReady() {
                        if (!iframe.contentWindow.document.getElementById('progress')) {
                            setTimeout(pollReady, 100);
                        } else {
                            resolve(iframe);
                        }
                    }
                    pollReady();
                });
            }
        });
    } // utile.prototype.iframe

    chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
        /* If the received message has the expected format... */
        if (msg.text && (msg.text == "getAddrs")) {

            var getAddrs = function(string) {
                if (!string) return undefined
                var regex = /[A][1-9A-HJ-NP-Za-km-z]{26,33}/g;
                var addrs = string.match(regex)
                var checked = []
                if (addrs) {
                    addrs = $.unique(addrs)
                    addrs.forEach(function(a) {
                        try {
                            a = new bitcoin.Address.fromBase58Check(a)
                            checked.push(a.toString())
                        } catch (e) {}
                    })
                }
                return checked
            }

            window.myhtml = $(document.all[0])

            // head
            var head = myhtml.find('head').html()
            var headAddrs = getAddrs(head)
                // body a tags
            var anchorsHtml = ''
            myhtml.find('body a').each(function(i, a) {
                //console.log(v)
                if (a.attribs && a.attribs.href)
                    anchorsHtml += ',' + a.attribs.href
            })
            var anchorAddrs = getAddrs(anchorsHtml)
                // body rest
            var body = myhtml.find('body').html()
            var bodyAddrs = getAddrs(body)
                // difference
            bodyAddrs = $(bodyAddrs).not(anchorAddrs).get()

            // TODO get CSS path for each
            //.prop('tagName').toLowerCase()
            //$[0].nodeName.toLowerCase()
            //.attr('class')
            //.attr('id')
            var addrs = {
                head: headAddrs ? headAddrs : [],
                anchors: anchorAddrs ? anchorAddrs : [],
                body: bodyAddrs ? bodyAddrs : [],
                //rawHtml: myhtml[0].innerHTML
            }

            // how to get iframes
            // http://stackoverflow.com/questions/1654017/how-to-expose-iframes-dom-using-jquery

            // to insert button
            // https://github.com/liviavinci/Boundary
            // or using web components... http://www.html5rocks.com/en/tutorials/webcomponents/imports/


            // user roles
            // - admin administrates the site's server and code
            // - poster creates content
            // - commenter replies to content

            sendResponse(addrs);
        }
    });

    window.util = ret;

})(window);