/**
 * index.js
 * Copyright (c) 2014 Mr. Awesome
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the MIT license.
 *
 * Controls index.html, the main wallet Chrome popover/Firefox panel
 */

/**
 * enables .on('show',somefunct) && .on('hide', somefunct)
 *
 * @todo may outsource to extra file since it is extending jquery
 */


(function($) {
    $.each(['show', 'hide'], function(i, ev) {
        var el = $.fn[ev];
        $.fn[ev] = function() {
            this.trigger(ev);
            return el.apply(this, arguments);
        };
    });

})(jQuery);

$(document).ready(function() {
    var APIURL = 'https://blockchain.coinawesome.com/api/'
    var MAPAPI = 'https://snapi.coinawesome.com/' // only occurence
    var TIPSBASEURL = 'http://tip.coinawesome.com/'

    // Setup the wallet, page values and callbacks
    var val = '',
        address = '',
        SATOSHIS = 100000000,
        FEE = SATOSHIS * .1
    AWEUnits = 'AWE',
    AWEMultiplier = SATOSHIS

    //////////////////////// BITCORE HD URL2ADDR ///////////////////
    var bitcore = require('bitcore')
    var Buffer = bitcore.deps.Buffer

    var netAwesome = {
        name: 'awesome',
        //alias: 'netAwesome',
        pubkeyhash: 23, //
        privatekey: 153, //
        scripthash: 83, //
        xpubkey: 0x0488b21e,
        xprivkey: 0x0488ade4,
        networkMagic: 0xcc362306, //
        port: 61224, //
        dnsSeeds: [
            // none yet
        ]
    }

    bitcore.Networks.add(netAwesome)

    var mpk = new bitcore.PublicKey('02674b07011a99c61f67543f3d2c6aba64770a8fb4856d89dfe563d0df453e1618')
        // var mpk = new bitcore.PublicKey('020b78f750de2fcc1a742e3dd00c87c6edc8a22e495c3a3a8e38acbb178649f562')

    // url to address
    var calcAddr = function(urlString, masterPublicKey) {
        var urlHash = bitcore.crypto.Hash.sha256(new Buffer(urlString))
        var urlBN = bitcore.crypto.BN.fromBuffer(urlHash)
        var urlPoint = bitcore.crypto.Point.getG().mul(urlBN).add(masterPublicKey.point)
        var urlAddress = bitcore.PublicKey.fromPoint(urlPoint).toAddress('awesome')
        return urlAddress
    }

    var getAddrForUrl = function(string) {
        return calcAddr(string, mpk).toString()
    }

    ///////////////////// BITCORE URL2ADDR ///////////////^^^^^^^

    // clear notification badge
    chrome.storage.local.set({
        'newInTxCount': 0 + ''
    })
    chrome.browserAction.setBadgeText({
        text: ''
    })

    function setupWallet() {
        var addr = wallet.getAddress()
        if (addr.length) {
            setQRCodes()
            wallet.updateBalance()
        } else {
            if (true) {
                console.log("GENERATING NEW WALLET " + new Date())
                // TODO show intro to user
                wallet.generateAddress().then(setQRCodes,
                    function() {
                        alert('Failed to generate wallet. Refresh and try again.');
                    })
            } else {
                console.log('STRANGE ERROR')
            }

        }

        function setQRCodes() {
            $('#qrcode').html(createQRCodeCanvas(wallet.getAddress()));
            $('#textAddress').text(wallet.getAddress());
        }
    }


    chrome.runtime.getBackgroundPage(function(win) {
        if (!win.wallet) throw new Exception(
            "Was not able to get Background Page Window Object.")
        wallet = win.wallet
        setupWallet()
        wallet.setBalanceListener(function(balance) {
            setBalance(balance);
        })
    })


    // $('#amount').on('keyup change', function () {
    //     val = Math.floor(Number($(this).val() * AWEMultiplier));
    //     if (val > 0) {
    //         currencyManager.formatAmount(val).then(function (formattedMoney) {
    //             var text = 'Amount: ' + formattedMoney;
    //             $('#amountLabel').text(text);
    //         });
    //     } else {
    //         $('#amountLabel').text('Amount:');
    //     }
    // });


    function setAWEUnits(units) {
        AWEUnits = units;
        if (units === 'bits') {
            AWEMultiplier = SATOSHIS / 1000000;
        } else if (units === 'mAWE') {
            AWEMultiplier = SATOSHIS / 1000;
        } else {
            AWEMultiplier = SATOSHIS;
        }

        setBalance(wallet.getBalance());
        $('#sendUnit').html(AWEUnits);
        $('#amount').attr('placeholder',
            '(Plus ' + FEE / AWEMultiplier + ' ' + AWEUnits + ' fee)')
            .attr('step', 1.0).val(null);
        $('#amountLabel').text('Amount:');
    }

    preferences.getAWEUnits().then(setAWEUnits);

    function setBalance(balance) {
        if (Number(balance) < 0 || isNaN(balance)) {
            balance = 0;
        }
        var text = balance / AWEMultiplier + ' ' + AWEUnits
        var unbalance = wallet.getUnBalance() / AWEMultiplier
        if (unbalance !== 0)
            text = text + ' | ' + unbalance + ' ' + AWEUnits + ' (unconfirmed)'
        $('#balance').text(text)
    }

    $('#successAlertClose').click(function() {
        $('#successAlert').fadeOut();
        if (typeof chrome === 'undefined') {
            addon.port.emit('resize', 278);
        }
    });

    $('#unkownErrorAlertClose').click(function() {
        $('#unknownErrorAlert').fadeOut();
    });

    if (typeof chrome === 'undefined') {
        addon.port.on('show', setupWallet);
    }

    /*
     *  Send AWE
     */
    $('#sendButton').click(function() {
        val = Math.round(Number($('#amount').val() * AWEMultiplier));
        address = $('#sendAddress').val();
        var balance = wallet.getBalance();
        var validAmount = true;
        if (val <= 0) {
            validAmount = false;
        } else if (val + FEE > balance) {
            validAmount = false;
        }
        if (validAmount) {
            $('#amountAlert').slideUp();
        } else {
            $('#amountAlert').slideDown();
        }

        var regex = /^[A][1-9A-HJ-NP-Za-km-z]{26,33}$/;
        var validAddress = true;
        if (!regex.test(String(address))) {
            validAddress = false;
        } else {
            try {
                new Bitcoin.Address.fromBase58Check(address);
            } catch (e) {
                validAddress = false;
                console.log('not valid address')
            }
        }

        if (validAddress) {
            $('#addressAlert').slideUp();
        } else {
            $('#addressAlert').slideDown();
        }

        if (validAddress && validAmount) {
            if (wallet.isEncrypted()) {
                // currencyManager.formatAmount(val).then(function (formattedMoney) {
                var text = 'Are you sure you want to send<br />' + val / AWEMultiplier + ' ' +
                    AWEUnits
                    //+ ' (<strong>' + formattedMoney + '</strong>)'
                    + '<br />to ' + address + ' ?';
                $('#sendConfirmationText').html(text);
                $('#sendConfirmationPassword').val(null);
                $('#sendConfirmationPasswordIncorrect').hide();
                $('#sendConfirmationModal').modal().show();

                $('#confirmSendButton').click(function() {
                    confirmSend();
                });
                //});
            } else {
                confirmSend();
            }
        }
    });



    function confirmSend() {
        $('#cover').show();
        var password = $('#sendConfirmationPassword').val();
        console.log('sending val FEE in index', val, FEE)
        wallet.send(address, val, FEE, password, false).then(function(txid) {
            $('#amount').val(null);
            $('#sendAddress').val(null);
            $('#amountLabel').text('Amount:');
            var text = 'Sent ' + val / AWEMultiplier + ' ' + AWEUnits + ' to ' + address +
                '.';
            $('#successAlertLabel').text(text);
            $('#successAlert').slideDown();
            $('#sendConfirmationModal').modal('hide');
            $('#cover').fadeOut('slow');
        }, function(e) {
            console.log(e)
            if (wallet.isEncrypted()) {
                $('#sendConfirmationPasswordIncorrect').text(e.message).slideDown();
            } else {
                $('#unknownErrorAlertLabel').text(e.message);
                $('#unknownErrorAlert').slideDown();
            }
            $('#cover').hide();
        });
    }

    /*
     *  Settings Menu
     */

    /*
     * Set Password
     */
    $('#setPassword').click(function() {
        $('#passwordMismatch').hide();
        $('#setPasswordIncorrect').hide();
        $('#setPasswordBlank').hide();
        if (wallet.isEncrypted()) {
            $('#removePasswordDiv').show();
            $('#setPasswordPassword').show().val(null);
        } else {
            $('#removePasswordDiv').hide();
            $('#setPasswordPassword').hide().val(null);
        }
        $('#newPassword').show().val(null);
        $('#confirmNewPassword').show().val(null);
        $('#removePassword').attr('checked', false);
        $('#setPasswordModal').modal().show();
    });

    $('#removePassword').click(function() {
        if (this.checked) {
            $('#newPassword').val(null).slideUp();
            $('#confirmNewPassword').val(null).slideUp();
        } else {
            $('#newPassword').slideDown();
            $('#confirmNewPassword').slideDown();
        }
    });

    $('#confirmSetPassword').click(function() {
        var password = $('#setPasswordPassword').val(),
            newPassword = $('#newPassword').val(),
            confirmNewPassword = $('#confirmNewPassword').val();
        var validInput = true;
        if ((wallet.isEncrypted() && !password) || (!$('#removePassword').is(':checked') &&
            (!newPassword || !confirmNewPassword))) {
            validInput = false;
            $('#setPasswordBlank').slideDown();
        } else {
            $('#setPasswordBlank').slideUp();
        }

        if (validInput && newPassword !== confirmNewPassword) {
            validInput = false;
            $('#passwordMismatch').slideDown();
        } else {
            $('#passwordMismatch').slideUp();
        }

        if (validInput && wallet.isEncrypted() && !wallet.validatePassword(password)) {
            validInput = false;
            $('#setPasswordIncorrect').slideDown();
        } else {
            $('#setPasswordIncorrect').slideUp();
        }

        if (validInput) {
            wallet.updatePassword(String(password), String(newPassword)).then(function() {
                $('#successAlertLabel').text('New password set.');
                $('#successAlert').show();
                $('#setPasswordModal').modal('hide');
            });
        }

    });

    /*
     * Currency selection
     */
    /*    $('#setCurrency').click(function () {
        preferences.getCurrency().then(function (currency) {
            var currencies = currencyManager.getAvailableCurrencies();
            var tableBody = '';
            for (var i = 0; i < currencies.length/3; i++) {
                tableBody += '<tr>';
                for (var j = i; j <= i+12; j+=6) {
                    tableBody += '<td><div class="radio no-padding"><label><input type="radio" name="' + currencies[j] + '"';
                    if (currencies[j] === currency) {
                        tableBody += ' checked';
                    }
                    tableBody += '>' + currencies[j] + '</label></div></td>';
                }
                tableBody += '</tr>';
            }
            $('#tableBody').html(tableBody);
            $('#setCurrencyModal').modal().show();
            $('.radio').click(function () {
                var currency = $.trim($(this).text());
                $('input:radio[name=' + currency + ']').attr('checked', 'checked');
                preferences.setCurrency(currency).then(function () {
                    $('#amountLabel').text('Amount:');
                    $('#successAlertLabel').text('Currency set to ' + currency + '.');
                    $('#successAlert').show();
                    $('#setCurrencyModal').modal('hide');
                });
            });
        });
    });*/

    /*
     * Units selection
     */
    $('#setUnits').click(function() {
        preferences.getAWEUnits().then(function(units) {
            var availableUnits = ['AWE', 'mAWE'];
            var tableBody = '<tr>';
            for (var i = 0; i < availableUnits.length; i++) {
                tableBody +=
                    '<td><div class="radio no-padding"><label><input type="radio" name="' +
                    availableUnits[i] + '"';
                if (availableUnits[i] === units) {
                    tableBody += ' checked';
                }
                tableBody += '>' + availableUnits[i] + '</label></div></td>';
            }
            tableBody += '</tr>';
            $('#tableBody').html(tableBody);
            $('#setCurrencyModal').modal().show();
            $('.radio').click(function() {
                var units = $.trim($(this).text());
                $('input:radio[name=' + units + ']').attr('checked', 'checked');
                setAWEUnits(units);
                preferences.setAWEUnits(units).then(function() {
                    $('#successAlertLabel').text('Units set to ' + units + '.');
                    $('#successAlert').show();
                    $('#setCurrencyModal').modal('hide');
                });
            });
        });
    });

    /*
     *  Show Private Key
     */
    $('#claim').click(function() {
        $('#showPrivateKeyPasswordIncorrect').hide();
        $('#privateKey').hide();
        $('#claimModal').modal().show();
    });

    $('#claimConfirm').click(function() {
        var url = MAPAPI + encodeURIComponent(currentAwesome.url) + '/claim'
        console.log('claiming... ', url)
        util.getJSON(url)
            .then(function(res) {
                if (res.STATUS === "SUCCESS") {
                    alert('Success! Check your balance!')
                    $('#claimModal').modal('hide')
                } else {
                    alert('Claim failed. Check the addresses (HTML) and try again later. ' + res.desc)
                    $('#claimModal').modal('hide')
                }
            }, function(e) {
                console.log(e)
            })
    });

    /*
     *  Show Private Key
     */
    $('#showPrivateKey').click(function() {
        $('#showPrivateKeyPasswordIncorrect').hide();
        if (wallet.isEncrypted()) {
            $('#showPrivateKeyPassword').val(null).show();
        } else {
            $('#showPrivateKeyPassword').hide();
        }
        $('#privateKey').hide();
        $('#showPrivateKeyModal').modal().show();
    });

    $('#showPrivateKeyConfirm').click(function() {
        var password = $('#showPrivateKeyPassword').val();
        if (wallet.isEncrypted() && !wallet.validatePassword(password)) {
            $('#showPrivateKeyPasswordIncorrect').slideDown();
        } else {
            $('#showPrivateKeyPasswordIncorrect').slideUp();
            var privateKey = wallet.getDecryptedPrivateKey(password);
            $('#privateKeyQRCode').html(createQRCodeCanvas(privateKey));
            $('#privateKeyText').text(privateKey);
            $('#privateKey').slideDown(function() {
                $('#main').height($('#showPrivateKeyModal').find('.modal-dialog').height());
            });
        }
    });

    /*
     *  Import Private Key
     */
    $('#importPrivateKey').click(function() {
        $('#importPrivateKeyPasswordIncorrect').hide();
        $('#importPrivateKeyBadPrivateKey').hide();
        if (wallet.isEncrypted()) {
            $('#importPrivateKeyPassword').val(null).show();
        } else {
            $('#importPrivateKeyPassword').hide();
        }
        $('#importPrivateKeyPrivateKey').val(null);
        $('#importPrivateKeyModal').modal().show();
    });

    $('#importPrivateKeyConfirm').click(function() {
        var privateKey = $('#importPrivateKeyPrivateKey').val();
        try {
            new Bitcoin.ECKey.fromWIF(privateKey);
        } catch (e) {
            $('#importPrivateKeyBadPrivateKey').slideDown();
            return;
        }
        wallet.importAddress($('#importPrivateKeyPassword').val(), privateKey).then(function() {
            setupWallet();
            $('#successAlertLabel').text('Private key imported successfully.');
            $('#successAlert').show();
            $('#importPrivateKeyModal').modal('hide');
        }, function(e) {
            if (e.message === 'Incorrect password') {
                $('#importPrivateKeyBadPrivateKey').slideUp();
                $('#importPrivateKeyPasswordIncorrect').slideDown();
            } else {
                $('#importPrivateKeyPasswordIncorrect').slideUp();
                $('#importPrivateKeyBadPrivateKey').slideDown();
            }
        });
    });

    /*
     *  Generate New Wallet
     */
    $('#generateNewWallet').click(function() {
        $('#generateNewWalletPasswordIncorrect').hide();
        if (wallet.isEncrypted()) {
            $('#generateNewWalletPassword').show().val(null);
        } else {
            $('#generateNewWalletPassword').hide();
        }
        $('#generateNewWalletModal').modal().show();
    });

    $('#generateNewWalletConfirm').click(function() {
        wallet.generateAddress($('#generateNewWalletPassword').val()).then(function() {
            setupWallet();
            $('#successAlertLabel').text('New wallet generated.');
            $('#successAlert').show();
            $('#generateNewWalletModal').modal('hide');
        }, function() {
            $('#generateNewWalletPasswordIncorrect').slideDown();
        });
    });

    /*
     * About
     */

    if (typeof chrome !== 'undefined') {
        $('#version').text(chrome.runtime.getManifest().version);
    } else {
        addon.port.on('version', function(version) {
            $('#version').text(version);
        });
    }

    $('#aboutModal').on('click', 'a', function() {
        if (typeof chrome !== 'undefined') {
            chrome.tabs.create({
                url: $(this).attr('href')
            });
        } else {
            addon.port.emit('openTab', $(this).attr('href'));
        }
        return false;
    });

    /*
     * Resizing
     */

    $('.modal').on('shown.bs.modal', function() {
        var $main = $('#main');
        var height = $main.height();
        var modalHeight = $(this).find('.modal-dialog').height();
        if (modalHeight > height) {
            $main.height(modalHeight);
            if (typeof chrome === 'undefined') {
                addon.port.emit('resize', modalHeight + 2);
            }
        }
    }).on('hidden.bs.modal', function() {
        $('#main').height('auto');
        if (typeof chrome === 'undefined') {
            if ($('#successAlert').is(':visible')) {
                var height = 350;
            } else {
                var height = 278;
            }
            addon.port.emit('resize', height);
        }
    });

    function createQRCodeCanvas(text) {
        var sizeMultiplier = 4;
        var typeNumber;
        var lengthCalculation = text.length * 8 + 12;
        if (lengthCalculation < 72) {
            typeNumber = 1;
        } else if (lengthCalculation < 128) {
            typeNumber = 2;
        } else if (lengthCalculation < 208) {
            typeNumber = 3;
        } else if (lengthCalculation < 288) {
            typeNumber = 4;
        } else if (lengthCalculation < 368) {
            typeNumber = 5;
        } else if (lengthCalculation < 480) {
            typeNumber = 6;
        } else if (lengthCalculation < 528) {
            typeNumber = 7;
        } else if (lengthCalculation < 688) {
            typeNumber = 8;
        } else if (lengthCalculation < 800) {
            typeNumber = 9;
        } else if (lengthCalculation < 976) {
            typeNumber = 10;
        }
        var qrcode = new QRCode(typeNumber, QRCode.ErrorCorrectLevel.H);
        qrcode.addData(text);
        qrcode.make();
        var width = qrcode.getModuleCount() * sizeMultiplier;
        var height = qrcode.getModuleCount() * sizeMultiplier;
        // create canvas element
        var canvas = document.createElement('canvas');
        var scale = 10.0;
        canvas.width = width * scale;
        canvas.height = height * scale;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        var ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        // compute tileW/tileH based on width/height
        var tileW = width / qrcode.getModuleCount();
        var tileH = height / qrcode.getModuleCount();
        // draw in the canvas
        for (var row = 0; row < qrcode.getModuleCount(); row++) {
            for (var col = 0; col < qrcode.getModuleCount(); col++) {
                ctx.fillStyle = qrcode.isDark(row, col) ? "#000000" : "#ffffff";
                ctx.fillRect(col * tileW, row * tileH, tileW, tileH);
            }
        }
        return canvas;
    }

    $('.awesome-nav-tab').click(function() {
        $('.awesome-nav-tab').removeClass('active')
        $('#settingsButton').removeClass('active')
        $(this).addClass('active')
        $('.awesome-tab').hide()
        $($(this).attr('data-tab-target')).show()
    });
    $('#settingsButton').click(function() {
        $('.awesome-nav-tab').removeClass('active')
        $(this).addClass('active')
    });

    $('.alert').on('show', function() {
        setTimeout(function() {
            $('.alert:visible').fadeOut(600);
        }, 2800);
    });


    /*
     *  Transaction History
     */
    // function initTxExpander() {
    //     $('.tx-info-label').click(function() {
    //         var wasActive = $(this).next('.tx-info').hasClass('active');
    //         $('.tx-info.active').removeClass('active').slideUp();
    //         $('.tx-info-expander.active').text('+');
    //         if (!wasActive) {
    //             $(this).next('.tx-info').addClass('active').slideDown();
    //             $(this).find('.tx-info-expander').addClass('active').text('-');
    //         }
    //     });
    // }


    function showHistory(filter) {
        wallet.getTransactions().then(function(transactions) {
            console.log(transactions)
            var txs = [];
            for (var id in transactions) txs.push(transactions[id]);

            txs.sort(function(a, b) {
                if (a.time < b.time) return 1;
                if (a.time > b.time) return -1;
                return 0;
            })

            var h = '';
            var odd = true

            txs.forEach(function(tx) {
                console.log(tx)
                var myIns = myOuts = toAddress = fromAddress = false
                var valueIn = valueOut = valueTotal = 0

                tx.vin.forEach(function(inn) {
                    // OUTGOING COINS
                    if (inn.addr === wallet.getAddress()) {
                        myIns = true
                        valueOut += inn.value
                        toAddress = tx.vout[0].addr
                    }
                })
                tx.vout.forEach(function(out) {
                    // INCOMING COINS
                    if (out.addr === wallet.getAddress()) {
                        myOuts = true
                        valueIn += out.value
                        fromAddress = tx.vin[0].addr
                    }
                })
                valueTotal = valueIn - valueOut
                if (valueTotal < 0) valueTotal += tx.fees * AWEMultiplier


                var address = valueTotal > 0 ? fromAddress : toAddress
                console.log(address, myIns, myOuts, valueTotal)

                var txHtmlItem = $('#transactionList-template').clone()


                txHtmlItem.find('a.tx-details-unusual').attr('href',
                    'http://api.coinawesome.com/tx/' + tx.txid).text(address)
                var d = new Date(tx.time * 1000);
                txHtmlItem.find('.tx-time').attr('title',
                    d.toISOString())

                var amountString = valueTotal / AWEMultiplier + ' ' + AWEUnits
                if (valueTotal > 0) {
                    txHtmlItem.find('.tx-amount').addClass(
                        'tx-amount-positive')
                    txHtmlItem.find('.tx-amount').text('+' + amountString)
                } else {
                    txHtmlItem.find('.tx-amount').text(amountString)
                    txHtmlItem.find('.tx-amount').addClass('tx-amount-negative')
                    // AWESOMED?
                    // localStorage.getItem(address)
                    localStorage.setItem(address, valueTotal)
                }

                var url = localStorage.getItem(tx.txid)
                if (url) {
                    var txHtmlItemData = $('#transactionList-template').clone()
                    txHtmlItemData.find('a.tx-details-unusual').attr('href',
                        url).text(url)
                    //txHtmlItemData.find('.txtime').hide()
                }
                if (!odd) {
                    txHtmlItem.find('.tx-even').addClass('tx-odd').removeClass('tx-even')
                    if (url) txHtmlItemData.find('.tx-even').addClass('tx-odd').removeClass(
                        'tx-even')
                }
                txHtmlItem.addClass('tx-item')
                var html = txHtmlItem.show().html()
                if (url) html += txHtmlItemData.show().html()

                h += html
                odd = !odd
            })
            $('#transactionList').html(h)
            $('.tx-time').timeago()

        }, function(e) {
            alert('OFFLINE? ' + e);
        });
    }

    //showHistory()
    $('#historyButton').click(showHistory);
    $('.tx-filter').click(function() {
        $(this).parent().find('.tx-filter').removeClass('active');
        $(this).addClass('active');
        showHistory($(this).data('filter'));
    });



    /*
     *  Awesome Button
     */
    currentAwesome = {
        addr: false,
        value: false,
        url: false,
        remote: { // values should be same. 
            addr: false,
            url: false
        }
    }
    var value = 1,
        clickedPlus = 1,
        clickedMinus = 1,
        clicked = 0,
        lastClicked

    // INIT FIBONACY
    var fib = util.fib
    fib(30)



    $('.plus-minus-container').find('a').click(function(e) {
        console.log('currentAwesome ', currentAwesome)
        if (!currentAwesome.url) return false
        if (!currentAwesome.addr) {
            var escUrl = encodeURIComponent(currentAwesome.url)
            var reqUrl = MAPAPI + escUrl
                //remoteCheck(reqUrl)
        }

        lastClicked = Date.now()
        var enoughMoney = wallet.getBalance() >= value + FEE
        if ($(e.target).hasClass('plus')) {
            if (clickedPlus < 29 && enoughMoney) {
                ++clickedPlus
                ++clicked
            }
        } else if ($(e.target).hasClass('minus') && clicked >= 0) {
            ++clickedMinus
            --clicked
        }

        value = fib.cache[clicked + 1] //* 0.0001  FOR BITCOIN// 100 bits
        // value = fib.cache[fib.cache.length - 1] //* 0.0001  FOR BITCOIN// 100 bits
        value = Math.round(value * SATOSHIS)


        $('#tipSum').html(value / AWEMultiplier);
        if (enoughMoney) {
            // $('#awesomeButton').find('#buttonText').html(" " + value + " AWE")
            currentAwesome.value = value


            // function updateButton(value) {
            //     //$('.awesome-button-text').html("" + Math.round(value / 100) + " bits"); BITCOIN
            //     // $('#tipSum').html("" + Math.round(value / AWEMultiplier) + " " + AWEUnits);
            // }

            // updateButton(value)

            //setTimeout(checkTimeout, 1510)
        } else {
            $('#unknownErrorAlertLabel').text("Your balance is not sufficient to tip more.")
            $('#unknownErrorAlert').slideDown()
        }


    })

    function checkTimeout() {
        if (lastClicked + 1500 < Date.now()) {
            if (currentAwesome.addr)
                sendAwesome()
            else {
                setTimeout(checkTimeout, 333)
            }
        }
    }

    function sendAwesome() {
        // first get tags
        checkTimeout
        var tags = $("#tagger").tagsinput('items')

        console.log('sending tx ', currentAwesome.addr, currentAwesome.value, SATOSHIS * 0.1,
            $('#password').val(), currentAwesome.url)
        console.log(wallet.getBalance())

        // todo verify on server URL<-->Address connection
        // send addr and URL to server
        // --> fetch URL on server 
        //      and check whether addr exists and is the same
        //  if not exists, then get new address for site
        //  if exists but is different, than show error at client


        ///////////////
        // var abc = $('.awesome-button-container')

        //var info = abc.find('.awesome-info')[0]
        //info.innerHTML = 'sending...'
        // info.style.display = 'block'

        /////////////////// DATA >
        var data = {
            u: currentAwesome.url,
            t: tags
        }
        var dataString = JSON.stringify(data)
        if (dataString.length > 256) {
            var eText = 'too many tags, remove some and continue (or make the URL shorter...) ' + dataString.length
                //showError(eText)

            $('#unknownErrorAlertLabel').text(eText);
            $('#unknownErrorAlert').slideDown()
            return false
        }
        console.log(dataString.length, dataString)
        //////////////////// < DATA

        var confirmSend = function(password) {
            currentAwesome.value = Math.round(currentAwesome.value)
            wallet.send(currentAwesome.addr, currentAwesome.value, SATOSHIS * 0.1, //password)
                //$('#password').val()
                password, dataString)
                .then(function(txid) {
                    console.log('\n\nsuccessfuly sent ' + txid + '\n\n')
                    localStorage.setItem(txid, currentAwesome.url)

                    // abc.find(".awesome-button-text2").text(
                    //     //' ' + Math.round(currentAwesome.value / 100))
                    //     ' ' + Math.round(currentAwesome.value / AWEMultiplier))
                    // abc.find(".awesome-button-text").text('awesome')
                    // abc.addClass('awesomed success')
                    // abc.data('value', 0)

                    // var info = abc.find('.awesome-info')[0]
                    // info.innerHTML = 'success!'
                    // info.style.display = 'block'

                    // remSuccess = function() {
                    //     $('.awesome-button-container').removeClass('success')
                    //     var info = abc.find('.awesome-info')[0]
                    //     info.innerHTML = ''
                    //     info.style.display = 'none'
                    // }
                    // setTimeout(remSuccess, 1000)
                    sendingAB = false
                    $('#tipSum').fadeOut('slow')
                    $('#tipSum').html('0')
                    currentAwesome.value = 0
                    $('#tipSum').fadeIn('slow')
                    $('#tagger').tagsinput('removeAll');
                    //$('#sendAddress').val(null);
                    //$('#amountLabel').text('Amount:');
                    // var text = 'Sent ' + currentAwesome.value / AWEMultiplier + ' ' +
                    //     AWEUnits + ' to ' + currentAwesome.addr + '.';
                    // $('#successAlertLabel').text(text);
                    // $('#successAlert').slideDown();
                    // $('#sendConfirmationModal').modal('hide');
                    $('#cover').fadeOut('slow');
                    // $iframe.find('#progress').fadeOut('fast', function () {
                    //     $iframe.find('#successAlert').fadeIn('fast').delay(1000).fadeIn('fast', removeFrame);
                    // });
                }, function(e) {

                    if (wallet.isEncrypted()) {
                        $('#sendConfirmationPasswordIncorrect').text(e.message).slideDown();
                    } else {
                        //showError("Error during send process. Are you online?")
                        $('#unknownErrorAlertLabel').text("An error occured: " + JSON.stringify(
                            e));
                        $('#unknownErrorAlert').slideDown()
                    }

                    $('#cover').hide()
                    return false
                })
        }

        //if (validAddress && validAmount) {
        if (wallet.isEncrypted()) {
            // currencyManager.formatAmount(val).then(function (formattedMoney) {
            var text = 'Are you sure you want to send<br />' + currentAwesome.value /
                AWEMultiplier + ' ' + AWEUnits
                //+ ' (<strong>' + formattedMoney + '</strong>)'
                + '<br />to ' + currentAwesome.addr + ' ?';
            $('#sendConfirmationText').html(text);
            $('#sendConfirmationPassword').val(null);
            $('#sendConfirmationPasswordIncorrect').hide();
            $('#sendConfirmationModal').modal().show();


            $('#confirmSendButton').click(function() {
                var password = $('#sendConfirmationPassword').val()
                confirmSend(password);
            });
            //});
        } else {
            // SENDING TRANSACTION IN WALLET OBJECT

            $('#cover').show();
            var password = $('#sendConfirmationPassword').val();
            confirmSend(password)
        }
        //}
    }

    $('#send-button').click(function() {
        sendAwesome()
    })

    var setAwesomedClass = function(addr) {
        var abc = $('.awesome-button-container')
        var value = localStorage.getItem(addr)
            //console.log(abc, value, addr)
        if (value) {
            // abc.find(".awesome-button-text2").text(
            //     ' ' + Math.round(-1 * value / AWEMultiplier))
            abc.addClass('awesomed')
        }
    }

    /*
    var remoteCheck = function(url) {
        // ask server if address exists for this url
        util.getJSON(url)
            .then(function(res) {
                console.log('remoteCheck ', res)

                var addr
                if (res.found && res.found.luckyAddr) {
                    addr = res.found.luckyAddr
                    $('#noMatch').hide()
                } else {
                    addr = res.addr
                    $('#claim').show()
                    $('#noMatch').hide()
                }
                $('#tipAddrs').html(addr)
                currentAwesome.addr = currentAwesome.remote.addr = addr

                /////////// AWESOMED?
                setAwesomedClass(addr)
                //////////

                $('#tips-total-container').fadeIn()
                util.getJSON(APIURL + 'addr/' + addr).then(function(res) {
                    $('#tipsTotal').fadeOut().text(res.totalReceivedSat /
                        AWEMultiplier).fadeIn()
                }, function(error) {
                    $('#tipsTotal').text('Check the connection and try again.')
                })

            }, function(error) {
                console.log('ERROR getting  ', url, error)
                $('#unknownErrorAlertLabel').text(error)
                if (error.message === "Network error") {
                    $('#unknownErrorAlertLabel').text("Network error." +
                        ' Could not reach coinawesome.com' +
                        " in order to get the tipping address.")
                }
                $('#unknownErrorAlert').slideDown()
            })
    }
    */


    chrome.tabs.query({
        currentWindow: true,
        active: true
    }, function(tabs) {
        var tab = tabs[0]
            // TODO remove everything after #hash
        var url = encodeURI(tab.url)
        var urlEl = document.createElement('a');
        urlEl.href = url
        currentAwesome.url = url
        //console.log(tabs)
        //console.log(url)
        $('#tipURL').html('<strong>' + urlEl.hostname + '</strong>' + urlEl.pathname + urlEl
            .search)

        // urlEl.protocol
        // urlEl.hostname 
        // urlEl.pathname

        var checkAddresses = function(addrs) {
            console.log(addrs)

            var checkedAddrs = []
            $.each(addrs, function(i, addr) {
                try {
                    new Bitcoin.Address.fromBase58Check(addr);
                    checkedAddrs.push(addr)
                } catch (e) {}
            })

            console.log(checkedAddrs)

            if (checkedAddrs.length > 1)
                console.log('multipe addresses')

            currentAwesome.addr = checkedAddrs[0]

            return checkedAddrs
        }

        var discussCheck = function(url) {
            try {
                util.getJSON(url)
                    .then(function(res) {
                            var topicUrl = TIPSBASEURL + 'topic/' + res.topic.slug
                            $('#discuss').attr('href', topicUrl).show()
                            $('#discuss').click(function() {
                                chrome.tabs.create({
                                    url: topicUrl
                                }, function(e) {
                                    console.log(e)
                                })
                            })
                            $('#discuss-container').fadeIn().fadeOut().fadeIn().fadeOut().fadeIn()

                        },
                        function(e) {
                            console.log('404 means: still not posted... you can be the first')
                        })
            } catch (e) {}
        }

        //console.log(tab)
        chrome.tabs.sendMessage(
            tab.id, {
                text: "getAddrs"
            }, function(r) {

                if (r) {
                    // unfluff not working because of misisng stop words files (nodeAPI vs chromeExtAPI)
                    // ... and possible other problems...
                    // POSTPONED
                    // var extracted = unfluff(r.rawHtml)
                    // console.log(extracted)

                    //checkAddresses(r)
                    // var addrs = $.merge([], r.head)
                    // var addrs = $.merge(addrs, r.body)
                    // var addrs = $.merge(addrs, r.anchors)
                    // console.log(addrs)
                    var count = 0
                    $('#local-addrs').find('optgroup').each(function(i, og) {
                        if ($(this).attr('label') === 'All') {
                            r.all.forEach(function(addr) {
                                $(og).append('<option>' + addr + '</option>')
                            })
                            count++
                            $(og).show()
                        }

                        // if ($(this).attr('label') === 'Head') {
                        //     r.head.forEach(function(addr) {
                        //         $(og).append('<option>' + addr + '</option>')
                        //     })
                        //     count++
                        //     $(og).show()
                        // }
                        // if ($(this).attr('label') === 'Body') {
                        //     r.body.forEach(function(addr) {
                        //         console.log(addr)
                        //         $(og).append('<option>' + addr + '</option>')
                        //     })
                        //     count++
                        //     $(og).show()
                        // }
                        // if ($(this).attr('label') === 'Anchors') {
                        //     r.anchors.forEach(function(addr) {
                        //         $(og).append('<option>' + addr + '</option>')
                        //     })
                        //     count++
                        //     $(og).show()

                        // }
                        if (count > 0)
                            $('.local-addrs-container').fadeIn()
                        else
                            $('.local-addrs-container').hide()
                            // FOR A BIT LATER
                            // var e = document.getElementById("ddlViewBy");
                            // var strUser = e.options[e.selectedIndex].text;
                            // OR
                            // $("#elementId :selected").text()

                        // if ($(this).attr('label') === 'User') {
                        //     r.user.forEach(function(addr) {
                        //         $(og).append($('<option>'+addr+'</option>'))
                        //     })
                        // }
                    })
                    //$('#tipAddrs-local').html(addrs.join("</br>"))
                }
            }
        )

        if (currentAwesome.url) {
            var cleanUrl = (url.substring(0, 7) == "http://" || url.substring(0,
                8) == "https://") ? url : "http://" + url;
            if (cleanUrl.charAt(cleanUrl.length - 1) === "/")
                cleanUrl = cleanUrl.substring(0, cleanUrl.length - 1)
            currentAwesome.url = cleanUrl;
        }

        var escUrl = encodeURIComponent(currentAwesome.url)


        var userUrl = TIPSBASEURL + 'user/' + wallet.getAddress().toLowerCase()
        $('#mytips').attr('href', userUrl).show()
        $('#mytips').click(function() {
            chrome.tabs.create({
                url: userUrl
            }, function(e) {
                console.log(e)
            })
        })

        // $('#popular').click(function() {
        //     chrome.tabs.create({
        //         url: TIPSBASEURL + 'popular/daily'
        //     }, function(e) {
        //         console.log(e)
        //     })
        // })
        $('#brand').click(function() {
            chrome.tabs.create({
                url: TIPSBASEURL + 'popular/weekly'
            }, function(e) {
                console.log(e)
            })
        })


        $('.blockexplorer-link').click(function() {
            chrome.tabs.create({
                url: 'http://api.coinawesome.com/address/' + wallet.getAddress()
            }, function(e) {
                console.log(e)
            })
        })



        /////////// WALLET ACTIVATED? //////////////////
        if (wallet.getBalance() > 0) {
            localStorage.setItem('walletActive', true)
        }

        if (localStorage.getItem('walletActive') === 'true') {
            // do nothing
        } else {
            $('#awesome-receive-tab-li').click()
            $('#awesome-tip-tab').hide()
            $('#main-nav').hide()
            //$('.nav').hide()
            $('#awesome-receive-tab h5').html('To activate the full wallet functionality you will need some coins first.' +
                "<h4>You can get free AWE coins at our giveaway at <a id='giveawaycoins' href='https://giveaway.coinawesome.com'>giveaway.coinawesome.com</a> </h4>"
            )
            $('#giveawaycoins').click(function() {
                chrome.tabs.create({
                    url: 'https://giveaway.coinawesome.com'
                }, function(e) {
                    console.log(e)
                })
            })
        }
        /////////////////////////////////////////////////

        $('#tagger').tagsinput({
            maxTags: 5
        })


        if (localStorage.getItem('detailsToggle') === "true") { // it's a string!
            $('.details-toggle-target').show()
            $('.bootstrap-tagsinput').show()
            $('#page-info-toggle span').html('-')
        }

        $('#page-info-toggle').click(function() {
            if (localStorage.getItem('detailsToggle') === "true") {
                $('.details-toggle-target').hide()
                $('.bootstrap-tagsinput').hide()
                $('#page-info-toggle span').html('+')
                localStorage.setItem('detailsToggle', false)
            } else {
                localStorage.setItem('detailsToggle', true)
                $('.details-toggle-target').show()
                $('.bootstrap-tagsinput').show()
                $('#page-info-toggle span').html('-')
            }
        })


        discussCheck(TIPSBASEURL + 'api/topic/byurl/' + escUrl)
        //remoteCheck(MAPAPI + escUrl)


        currentAwesome.addr = getAddrForUrl(currentAwesome.url)
        $('#claim').show()
        $('#noMatch').hide()
        $('#tipAddrs').html(currentAwesome.addr)
        setAwesomedClass(currentAwesome.addr)

        //console.log(currentAwesome)

        $('#local-addrs').change(function(e) {
            var addr = $('#local-addrs').val()
            currentAwesome.addr = addr
            $('#tipAddrs').text(addr)
            util.getJSON(APIURL + 'addr/' + addr).then(function(res) {
                $('#tipsTotal').fadeOut().text(res.totalReceivedSat /
                    AWEMultiplier).fadeIn()
            }, function(error) {
                $('#tipsTotal').text('Check the connection and try again.')
            })
        })

        $('[data-toggle="tooltip"]').tooltip()
    })
})