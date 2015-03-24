/**
 * btn.js
 * Copyright (c) 2014 Mr. Awesome
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the MIT license.
 *
 * Controls btn.html, the popup that appears when clicking on awesome:A... links,
 * or by clicking the context menu
 */


cl = function(string) {
    console.log(string)
}
$(document).ready(function() {
    var SATOSHIS = 100000000,
        FEE = SATOSHIS * .1,
        AWEUnits = 'AWE',
        AWEMultiplier = SATOSHIS,
        clickX,
        clickY,
        port = null

    $('.awesome-button-container').addClass('activeExtension')


    // Event is broadcast when context menu is opened on the page
    $(document).on('contextmenu', function(e) {
        // Save the position of the right click to use for positioning the popup
        clickX = e.clientX;
        clickY = e.clientY;
        if (typeof chrome !== 'undefined') {
            // In Chrome we open a port with the background script
            // to tell us when the menu item is clicked
            if (port) {
                port.disconnect();
            }
            port = chrome.runtime.connect();
            port.onMessage.addListener(function(response) {
                var rect = null;
                if (response.address) {
                    // We only have an address in Chrome if it was selected by right clicking,
                    // so we can get the location of the address by finding the selection
                    rect = window.getSelection().getRangeAt(0).getBoundingClientRect();
                }
                showPopup(response.address, null, rect);
            });
        }
    })

    if (typeof chrome === 'undefined') {
        // In Firefox we listen for the pay message to be sent
        self.port.on('pay', function(message) {
            if (message.address) {
                // If we have an address, the position of the address is sent as well
                var rect = {};
                rect.left = message.left;
                rect.right = message.right;
                rect.top = message.top;
                rect.bottom = message.bottom;
                showPopup(message.address, null, rect);
            } else {
                showPopup(null, null, null);
            }
        });
    }

    var showError = function(etext) {
        showMore('.awesome-error', etext)
    }
    var showInfo = function(etext) {
        showMore('.awesome-info', etext)
    }

    var showMore = function(selector, text) {
        var info = $(selector)
        info.text(text)
        info.data('value', 0)
        // info.fadeIn('fast')
        info.show()

        $(".awesome-button-text").text('awesome')

        var remove = function() {
            var info = $(selector)
            info.text('')
            info.hide()
        }
        setTimeout(remove, 1500)
    }

    // Button // intercept clicks on a tags
    $('body').on('click', 'a', function(e) {
        var href = $(this).attr('href');
        var parent = $(this).parent()

        // Validating address
        var address = util.valAddr(href)
        if (!address) {
            // showError('This is not a valid awesome address.')
            // Return true if not a bitcoin link so click will work normally
            return true
        }
        if (parent.hasClass('awesome-button-container')) {
            var abc = parent
            buttonLogic(address, abc)
            return false
        } else {
            showPopup(address, 0, this.getBoundingClientRect(), $(this));
            return false
        }
        return false

    })

    var clicked = 1,
        lastClicked

    var buttonLogic = function(address, abc) {
        lastClicked = Date.now()
        var value = abc.data('value')
            //var address = abc.data('address')

        function updateButton(value) {
            abc.find('.awesome-button-text').html("" + value + " AWE");
        }

        function checkTimeout() {
            if (lastClicked + 1500 < Date.now()) {
                // check if not already sending something...
                if (typeof window.sendingAB === "undefined" || !sendingAB)
                    console.log('sending AWE...')
                sendTx()
            }
        }

        function sendTx() {
            sendingAB = true
            //console.log('sendTx()...')

            var validAmount = true,
                validAddress = true,
                valueSat;

            valueSat = value * AWEMultiplier;

            var balance = wallet.getBalance();
            if (valueSat <= 0) {
                validAmount = false;
            } else if (valueSat + FEE > balance) {
                validAmount = false;
            }

            //console.log(valueSat, newAddress, validAddress, validAmount)

            //$iframe.find('#password').parent().removeClass('has-error');

            // TODO improve error handling
            if (!validAddress) {
                showError('no valid address')
                console.log('no valid address')
                //$iframe.find('#errorAlert').text('Invalid address').slideDown();
                //$iframe.find('#address').parent().addClass('has-error');
            } else if (!validAmount) {
                showError('Your balance is not sufficient: ' + balance)
                console.log('no valid amount')
                //$iframe.find('#errorAlert').text('Insufficient funds').slideDown();
                //$iframe.find('#amount').parent().addClass('has-error');
            } else if (!navigator.onLine) { // not needed for local dev environment
                showError('no internet connection')
                console.log('no internet connection')
            } else if (wallet.isEncrypted()) { // 
                showError('Wallet is encrypted.')
                console.log('Wallet is encrypted.')

                //$iframe.find('#errorAlert').text('Connection offline').slideDown();
                //$iframe.find('#amount').parent().addClass('has-error');
            } else {
                //$(document).off('click.wallet contextmenu.wallet');
                // $iframe.find('#errorAlert').slideUp();
                // $iframe.find('#amount').parent().fadeOut('fast');
                // $iframe.find('#address').parent().fadeOut('fast');
                // $iframe.find('#password').parent().fadeOut('fast');

                var url = (window.location != window.parent.location) ? document.referrer : document.location;

                // var url = window.location.href
                console.log('presend:', address, valueSat, SATOSHIS * 0.1, abc.find(
                    '#password').val(), url)

                var info = abc.find('.awesome-info')[0]
                info.innerHTML = 'sending...'
                info.style.display = 'block'

                var data = {
                    u: url
                }

                // SENDING TRANSACTION IN WALLET OBJECT
                // TODO improve FEE estimate
                wallet.send(address, valueSat, SATOSHIS / 10, abc.find('#password').val(),
                    JSON.stringify(data)).then(function() {
                    console.log('\nsuccess\n')
                    abc.find(".awesome-button-text2").text(' ' + value)
                    abc.find(".awesome-button-text").text('awesome')
                    abc.addClass('awesomed success')
                    abc.data('value', 0)

                    var info = abc.find('.awesome-info')[0]
                    info.innerHTML = 'success!'
                    info.style.display = 'block'

                    remSuccess = function() {
                        $('.awesome-button-container').removeClass('success')
                        var info = abc.find('.awesome-info')[0]
                        info.innerHTML = ''
                        info.style.display = 'none'
                    }
                    setTimeout(remSuccess, 1000)
                    sendingAB = false

                    // $iframe.find('#progress').fadeOut('fast', function () {
                    //     $iframe.find('#successAlert').fadeIn('fast').delay(1000).fadeIn('fast', removeFrame);
                    // });
                }, function(e) {
                    showError("Error during send process. Are you online?")
                })

            }

            // $(document).on('click.wallet contextmenu.wallet', removeFrame);

            // function removeFrame() {
            //     $(document).off('click.wallet contextmenu.wallet');
            //     $(iframe).fadeOut('fast', function () {
            //         $(this).remove();
            //     });
            // }

        }

        if (value) {
            ++clicked
            var fib = util.fib
            fib(clicked + 1)
            value = fib.cache[fib.cache.length - 1]

        } else { // INIT WALLET
            value = 1
            wallet.restoreAddress().then(function() {
                if (wallet.isEncrypted()) {
                    // Only show password field if the wallet is encrypted
                    // TODO 
                    // $(this).find('#password').parent().show(); << security risk
                    // shoud open extension popup instead
                }
            }, function() {
                wallet.generateAddress();
            });

            preferences.getAWEUnits().then(function(units) {
                AWEUnits = units;
                if (units === 'bits') {
                    AWEMultiplier = SATOSHIS / 1000000;
                } else if (units === 'mAWE') {
                    AWEMultiplier = SATOSHIS / 1000;
                } else {
                    AWEMultiplier = SATOSHIS;
                }
                //abc.find('.awesome-button-text').attr('placeholder', 'Amount (' + AWEUnits + ')').attr('step', 100000 / AWEMultiplier);
            });

        }

        abc.data('value', value)
        abc.data('address', address)
        updateButton(value)
        //lastClickedAB = Date.now()
        setTimeout(checkTimeout, 1500)
    }

    function showPopup(address, amount, rect, appendTo) {
        // TODO remove probably
        util.iframe('btn.html', appendTo).then(function(iframe) {

            iframe.style.height = '410px';
            iframe.style.width = '410px';
            var offset = {}
            if (rect) {
                offset.left = Number(rect.left) + Number(window.pageXOffset) + Number(rect.right -
                    rect.left) / 2 - 75;
                offset.top = Number(window.pageYOffset) + Number(rect.top) - 9
            } else {
                offset.left = Number(clickX) + Number(window.pageXOffset);
                offset.top = Number(clickY) + Number(window.pageYOffset);
            }
            iframe.style.left = offset.left + 'px';
            iframe.style.top = offset.top + 'px';

            var $iframe = $(iframe.contentWindow.document);

            $iframe.find("a").attr('href', 'awesome:' + address)

            var abc = $iframe.find(".awesome-button-container")
            $iframe.on('click', 'a', function(e) {
                buttonLogic(address, abc)
                return false
            })
            buttonLogic(address, abc)
        })
    }
})