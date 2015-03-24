/*
 * wallet.js
 * Copyright (c) 2014 Mr. Awesome
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the MIT license.
 *
 * Wallet handles the address, private key and encryption,
 * as well as sending and determining balance
 */

(function(window) {
    //var APIbaseURL = 'http://api.coinawesome.com/' // insight
    var APIbaseURL = 'https://blockchain.coinawesome.com/' // insight

    var balance = 0,
        unconfirmedBalance = 0,
        address = '',
        privateKey = '',
        isEncrypted = false,
        balanceListener = null,
        transactions = {},
        SATOSHIS = 100000000,
        Bitcoin = bitcoin,
        loadedTimes = 0,
        APIs = {};

    var satRound = function(number) {
        return parseInt(number * SATOSHIS) / SATOSHIS
    }

    // reload every 10 times extension is opened
    // do it when a tab is closed only
    if (chrome.tabs) {
        chrome.tabs.onRemoved.addListener(function(tabid, removeInfo) {
            if (loadedTimes > 10)
                chrome.runtime.reload()
        })
    }

    var insight_input = function(s) {
        var d = s;
        d.scriptSig = Bitcoin.Script.fromASM(s.scriptSig.asm).toHex();
        d.value = s.valueSat;
        return d;
    }
    var insight_output = function(s) {
        return {
            "value": s.value * SATOSHIS,
            "n": s.n,
            "scriptPubKey": Bitcoin.Script.fromASM(s.scriptPubKey.asm).toHex(),
            "addr": 'addresses' in s.scriptPubKey && s.scriptPubKey.addresses.length ? s.scriptPubKey
                .addresses[0] : null
        };
    }
    var normalizeInTx = function(s) {
        var d = s;
        var vin = s.vin;
        var vout = s.vout;
        d.txid = s.txid.toLowerCase();
        d.vin = [];
        d.vout = [];
        for (var i = 0; i < vin.length; i++) d.vin.push(insight_input(vin[i]));
        for (var i = 0; i < vout.length; i++) d.vout.push(insight_output(vout[i]));
        return d;
    };
    var server = function(baseURL) {
        if (baseURL.slice(-1) == '/') baseURL = baseURL.slice(0, -1);
        this.baseURL = baseURL;
        this.APIURL = baseURL + '/api/';
        this.socket = null;
    }
    server.prototype = {
        getBalance: function(address) {
            loadedTimes++
            var APIURL = this.APIURL //+ 'api/';
                //console.log('getting Balance from server for ', address)
            return new Promise(function(resolve, reject) {
                util.get(APIURL + 'addr/' + address + '?noTxList=1&noCache=1')
                    .then(function(response) {
                        response = JSON.parse(response)
                        var balance = response.balanceSat + response.unconfirmedBalanceSat
                            //console.log("BALANCE IS ", balance / SATOSHIS)
                        unconfirmedBalance = response.unconfirmedBalanceSat // TODO move from here

                        if (isNaN(balance) || !isFinite(balance))
                            reject('Invalid response from server');
                        resolve(balance);
                    }, function(e) {
                        reject(Error('Failed to communicate with server (' + e.message +
                            ')'));
                    });
            });
        },
        getNewTransactions: function(address, knownTxs) {
            //console.log(address)
            //console.log(knownTxs)

            var APIURL = this.APIURL;
            return new Promise(function(resolve, reject) {
                var newTxs = {};
                var getTransactions = function(page) {
                    util.getJSON(APIURL + 'txs/?address=' + address + '&pageNum=' +
                        page)
                        .then(function(json) {
                            var seenNew = false
                                //console.log(json.pagesTotal)
                            json.txs.forEach(function(tx) {
                                newTxs[tx.txid] = normalizeInTx(tx)
                                if (!(tx.txid in knownTxs)) {
                                    seenNew = true
                                    //console.log('new tx!!')
                                }

                            })
                            // for (var i = 0; i < json.txs.length; i++) {
                            //     if (!(json.txs[i].txid in knownTxs || json.txs[i]
                            //         .txid in newTxs)) seenNew = true;
                            //     newTxs[json.txs[i].txid] = normalizeInTx(json.txs[i]);
                            // }
                            page++;
                            if (seenNew && page < 20 && page <= json.pagesTotal) {
                                console.log('getting more txs... page ', page)
                                getTransactions(page); //TODOj improve 
                            } else {
                                resolve(newTxs);
                            }
                        }, function(e) {
                            resolve(knownTxs)
                            // reject(Error('Failed to communicate with server (' +
                            //     e.message + ')'));
                        });
                };
                getTransactions(0);
            });
        },
        getUnspent: function(address) {
            var APIURL = this.APIURL

            return new Promise(function(resolve, reject) {
                var ir = function() {
                    reject('Invalid response from server');
                }
                util.getJSON(APIURL + 'addr/' + address + '/utxo?noCache=1').then(
                    function(json) {
                        var unspents = [];
                        json.forEach(function(unspent) {
                            unspents.push({
                                "hash": unspent.txid,
                                "n": unspent.vout,
                                "script": unspent.scriptPubKey,
                                "value": unspent.amount * SATOSHIS,
                                "confirmations": unspent.confirmations
                            })
                        })
                        resolve(unspents);
                    }, function(e) {
                        reject(Error('Failed to communicate with server (' + e.message +
                            ')'));
                    });
            });
        },
        sendTransaction: function(transaction, url) {
            var APIURL = this.APIURL;
            return new Promise(function(resolve, reject) {
                util.post(APIURL + 'tx/send',
                    'rawtx=' + transaction.toHex() + '&data=' + url
                ).then(
                    function(r) {
                        var txid = JSON.parse(r).txid
                        resolve(txid)
                    },
                    function(e) {
                        reject(Error('Failed to send transaction: ' + e.message + ' ' +
                            transaction.toHex()));
                    });
            });
        },
        liveTransactions: function(address, handler) {
            if (window.location.protocol === "chrome-extension:") {
                var APIURL = 'http://api.coinawesome.com/api/' // this.APIURL;
                if (this.socket) this.socket.disconnect();
                var socket = io(APIURL);
                this.socket = socket;
                socket.on('connect', function() {
                    console.log('### Connected to socketAPI ' + APIURL)
                    socket.emit('subscribe', address) //'inv'); 
                    console.log('subscribing to ', address)
                })
                socket.on(address, function(txid) {
                    console.log('New txid through socket... ', txid)

                    util.getJSON(APIURL + 'tx/' + txid).then(function(json) {
                        var tx = normalizeInTx(json)
                        handler(tx)
                        //var hasTxForMe = false
                        //var tx = normalizeInTx(json);
                        //for (var i = 0; i < tx.vin.length; i ++) if (tx.vin[i].addr == address) return handler(tx);
                        //for (var i = 0; i < tx.vout.length; i ++) if (tx.vout[i].addr == address) return handler(tx);
                    })
                })
            }
        }
    };
    APIs.insight = server

    server = new APIs.insight(APIbaseURL)

    /////////////////////////////// WALLET//////////////////////////
    var wallet = function() {}

    wallet.prototype = {

        getAddress: function() {
            return address
        },
        getBalance: function() {
            return balance
        },
        getUnBalance: function() {
            return unconfirmedBalance
        },
        isEncrypted: function() {
            return isEncrypted
        },
        // Balance listener gets called with new balance whenever it updates
        setBalanceListener: function(listener) {
            balanceListener = listener;
        },

        // Create a new address
        generateAddress: function(password) {
            return new Promise(function(resolve, reject) {
                if (myWallet.validatePassword(password)) {
                    var eckey = new Bitcoin.ECKey.makeRandom(false)
                    var addr = eckey.pub.getAddress().toString()
                    if (isEncrypted) {
                        if (typeof chrome !== 'undefined') {
                            privateKey = CryptoJS.AES.encrypt(eckey.toWIF(), password);
                        } else {
                            privateKey = JSON.parse(CryptoJS.AES.encrypt(eckey.toWIF(),
                                password, {
                                    format: jsonFormatter
                                }));
                        }
                    } else {
                        privateKey = eckey.toWIF();
                    }
                    address = eckey.pub.getAddress().toString();
                    //console.log("GENERATED NEW ADDRESS", address)
                    balance = 0;
                    transactions = {};
                    Promise.all([
                        preferences.setAddress(address),
                        preferences.setPrivateKey(privateKey),
                        preferences.setIsEncrypted(isEncrypted)
                    ]).then(function() {
                        myWallet.updateBalance()
                        resolve();
                    });
                } else {
                    reject(Error('Incorrect password'));
                }
            });
        },

        // Restore the previously saved address
        restoreAddress: function() {
            return new Promise(function(resolve, reject) {
                Promise.all([
                    preferences.getAddress(),
                    preferences.getPrivateKey(),
                    preferences.getIsEncrypted()
                ]).then(function(values) {
                    if (values[0].length > 0) {
                        address = values[0];
                        privateKey = values[1];
                        isEncrypted = values[2];
                        transactions = {};
                        myWallet.updateBalance();
                        resolve();
                    } else {
                        reject(Error('No address'));
                    }
                });
            });
        },

        // Import an address using a private key
        importAddress: function(password, _privateKey) {
            return new Promise(function(resolve, reject) {
                if (myWallet.validatePassword(password)) {
                    try {
                        var eckey = new Bitcoin.ECKey.fromWIF(_privateKey);
                        if (isEncrypted) {
                            if (typeof chrome !== 'undefined') {
                                privateKey = CryptoJS.AES.encrypt(eckey.toWIF(),
                                    password);
                            } else {
                                privateKey = JSON.parse(CryptoJS.AES.encrypt(eckey.toWIF(),
                                    password, {
                                        format: jsonFormatter
                                    }));
                            }
                        } else {
                            privateKey = eckey.toWIF();
                        }
                        address = eckey.pub.getAddress().toString();
                        balance = 0;
                        tranactions = {};
                        Promise.all([
                            preferences.setAddress(address),
                            preferences.setPrivateKey(privateKey),
                            preferences.setLastBalance(0)
                        ]).then(function() {
                            myWallet.updateBalance();
                            resolve();
                        });
                    } catch (e) {
                        reject(Error('Invalid private key'));
                    }
                } else {
                    reject(Error('Incorrect password'));
                }
            });
        },

        // Check if the password is valid
        validatePassword: function(password) {
            if (isEncrypted) {
                try {
                    // If we can decrypt the private key with the password, then the password is correct
                    // We never store a copy of the password anywhere
                    if (typeof chrome !== 'undefined') {
                        return CryptoJS.AES.decrypt(privateKey, password).toString(CryptoJS.enc.Utf8);
                    } else {
                        return CryptoJS.AES.decrypt(JSON.stringify(privateKey), password, {
                            format: jsonFormatter
                        }).toString(CryptoJS.enc.Utf8);
                    }
                } catch (e) {
                    return false;
                }
            } else {
                return true;
            }
        },

        // Return a decrypted private key using the password
        getDecryptedPrivateKey: function(password) {
            if (isEncrypted) {
                if (typeof chrome !== 'undefined') {
                    var decryptedPrivateKey = CryptoJS.AES.decrypt(privateKey, password);
                } else {
                    var decryptedPrivateKey = CryptoJS.AES.decrypt(JSON.stringify(privateKey),
                        password, {
                            format: jsonFormatter
                        });
                }
                try {
                    if (!decryptedPrivateKey.toString(CryptoJS.enc.Utf8)) {
                        return null;
                    }
                } catch (e) {
                    return null;
                }
                return decryptedPrivateKey.toString(CryptoJS.enc.Utf8);
            } else {
                return privateKey;
            }
        },

        // Transaction list
        getTransactions: function() {
            return new Promise(function(resolve, reject) {
                if (!address.length) {
                    transactions = {};
                    resolve(transactions);
                }
                server.getNewTransactions(address, transactions).then(function(txs) {
                    // Add fetched transactions to the cache
                    //console.log('GOT ', Object.keys(txs).length) //, txs)
                    //console.log('OLDALL ', Object.keys(transactions).length) //, transactions)
                    for (var id in txs) transactions[id] = txs[id]
                        //console.log('NEWALL ', Object.keys(transactions).length) //, transactions)
                        //preferences.setTxs(JSON.strinigfy(transactions))
                    resolve(transactions);
                }, function(e) {
                    console.log(e)
                    reject()
                });
            });
        },

        // Gets the current balance and sets up a websocket to monitor new transactions
        updateBalance: function() {
            // Make sure we have an address
            if (address.length) {
                // Last stored balance is the fastest way to update
                preferences.getLastBalance().then(function(result) {
                    balance = result;
                    if (balanceListener) balanceListener(balance);
                    server.getBalance(address).then(function(response) {
                        //console.log('UPDATED balance ' + response)
                        balance = response
                        return preferences.setLastBalance(balance);
                    }).then(function() {
                        if (balanceListener) balanceListener(balance);
                        server.liveTransactions(address, function(tx) {

                            var inputs = tx.vin;
                            var outputs = tx.vout;
                            var i, hasOutputForMe

                            // Subtract all inputs from the balance
                            inputs.forEach(function(input) {
                                if (input.addr === address) {
                                    balance = Number(balance) - Number(input.value)
                                }
                            })
                            // Add all output to the balance
                            outputs.forEach(function(out) {
                                if (output.addr === address) {
                                    balance = Number(balance) + Number(output.value);
                                    hasOutputForMe = true
                                }
                            })
                            if (hasOutputForMe) {
                                // inputs known because sending is active in Bitcoin
                                // thus only notify when outputs
                                // TODOj move to other place, not wallet logic
                                chrome.storage.local.get('newInTxCount', function(r) {
                                    var num = parseInt(r.newInTxCount)
                                    if (num === NaN) {
                                        num = 1
                                    } else {
                                        num++
                                    }
                                    chrome.storage.local.set({
                                        'newInTxCount': num + ''
                                    })
                                    chrome.browserAction.setBadgeText({
                                        text: num + ''
                                    })
                                    chrome.browserAction.setBadgeBackgroundColor({
                                        color: '#4CFF4C'
                                    })
                                })
                            }
                            // Save the new balance and notify the listener
                            preferences.setLastBalance(balance).then(function() {
                                if (balanceListener) balanceListener(balance);
                            });
                        });
                    });
                });
            } else console.log("no address")
        },

        transactions: transactions
    };


    /////////////////////// WALLET INIT //////////////////////////

    var myWallet = new wallet()
        // LOCALSTORAGE CACHE NEEDED WHEN BACKGROUND SCRIPT?
        // if (address.length) {
        //     console.log('adderss is ', address)
        //     preferences.getTxs().then(function(txs) {
        //         txs = JSON.parse(txs)
        //         console.log('from localstroage ', txs)
        //         transactions = txs
        //     })
        // }

    // Change the password to a new password
    wallet.prototype.updatePassword = function(password, newPassword) {
        return new Promise(function(resolve, reject) {
            // Make sure the previous password is correct
            var decryptedPrivateKey = myWallet.getDecryptedPrivateKey(password);
            if (decryptedPrivateKey) {
                // If we have a new password we use it, otherwise leave cleartext
                if (newPassword) {
                    if (typeof chrome !== 'undefined') {
                        privateKey = CryptoJS.AES.encrypt(decryptedPrivateKey,
                            newPassword);
                    } else {
                        privateKey = JSON.parse(CryptoJS.AES.encrypt(decryptedPrivateKey,
                            newPassword, {
                                format: jsonFormatter
                            }));
                    }
                    isEncrypted = true;
                } else {
                    privateKey = decryptedPrivateKey;
                    isEncrypted = false;
                }
                // Save the encrypted private key
                // Passwords are never saved anywhere
                Promise.all([preferences.setIsEncrypted(isEncrypted), preferences.setPrivateKey(
                    privateKey)]).then(resolve);
            } else {
                reject(Error('Incorrect password'));
            }
        });
    };

    wallet.prototype.send = function(sendAddress, amount, fee, password, data, cb) {
        //console.log('sending inside wallet')
        return new Promise(function(resolve, reject) {
            if (sendAddress === address) {
                //console.log('You are trying to send money to yourself. This is not recommended.')
                reject(Error('You are trying to send money to yourself. This is not recommended.'))
                return
            }
            var decryptedPrivateKey = myWallet.getDecryptedPrivateKey(password);
            if (decryptedPrivateKey) {
                // Get all unspent outputs to generate our inputs
                server.getUnspent(address).then(function(unspents) {
                    //console.log('UNSPENTS are ', unspents)

                    var accum = 0
                    var addresses = []
                    var subTotal = amount
                    var change

                    var txb = new Bitcoin.TransactionBuilder()

                    // RECEIVING ADDRESS
                    txb.addOutput(sendAddress, amount)
                    for (var i = 0; i < unspents.length; ++i) {
                        var unspent = unspents[i]
                        addresses.push(address)

                        txb.addInput(unspent.hash, unspent.n)

                        //console.log('accum is ', accum)

                        accum = Math.round(accum + unspent.value)
                        subTotal = Math.round(amount + fee)

                        if (accum >= subTotal) {
                            change = Math.round(accum - subTotal)
                            //console.log(change)
                            break
                        }
                    }
                    //console.log('accum is ', accum)

                    // DATA
                    // Adding OP_RETURN value
                    if (data) {
                        //console.log('### DATA: ', data)

                        function toHex(str) {
                            var result = '';
                            for (var i = 0; i < str.length; i++) {
                                result += str.charCodeAt(i).toString(16);
                            }
                            return result;
                        }
                        var hexData = toHex(data)

                        txb.addOutput(Bitcoin.Script.fromASM("OP_RETURN " + hexData), 0)
                        // for BITCOIN 546)
                    }

                    // CHANGE
                    txb.addOutput(address, change)
                    // if (change > 100) { // else become tx fee
                    // }

                    //assert(accum >= subTotal, 'Not enough funds (incl. fee): ' + accum + ' < ' + subTotal)

                    addresses.forEach(function(address, i) {
                        var eckey = Bitcoin.ECKey.fromWIF(decryptedPrivateKey)
                        txb.sign(i, eckey)
                    })
                    var sendTx = txb.build()
                        //console.log('TX TO BE SEND', sendTx, data)

                    ////
                    server.sendTransaction(sendTx, data).then(function(txid) {
                        console.log('server.send...', txid)
                        // Notify the balance listener of the changed amount immediately,
                        // but don't set the balance since the transaction will be processed by the websocket
                        if (balanceListener) balanceListener(balance - amount -
                            fee);

                        resolve(txid);
                    }, function(rej) {
                        console.log(rej)
                        reject(rej.message) //Error('ERROR ',rej));
                    });
                }, function(rej) {
                    console.log(rej)
                    reject(rej.message + " [Blockexplorer API]") //Error('ERROR ',rej));
                })
            } else {
                reject(Error('Incorrect password'));
            }
        });
    }

    var jsonFormatter = {
        stringify: function(cipherParams) {
            // create json object with ciphertext
            var jsonObj = {
                ct: cipherParams.ciphertext.toString(CryptoJS.enc.Hex)
            };

            // optionally add iv and salt
            if (cipherParams.iv) {
                jsonObj.iv = cipherParams.iv.toString();
            }
            if (cipherParams.salt) {
                jsonObj.s = cipherParams.salt.toString();
            }

            // stringify json object
            return JSON.stringify(jsonObj);
        },

        parse: function(jsonStr) {
            // parse json string
            var jsonObj = JSON.parse(jsonStr);

            // extract ciphertext from json object, and create cipher params object
            var cipherParams = CryptoJS.lib.CipherParams.create({
                ciphertext: CryptoJS.enc.Hex.parse(jsonObj.ct)
            });

            // optionally extract iv and salt
            if (jsonObj.iv) {
                cipherParams.iv = CryptoJS.enc.Hex.parse(jsonObj.iv)
            }
            if (jsonObj.s) {
                cipherParams.salt = CryptoJS.enc.Hex.parse(jsonObj.s)
            }

            return cipherParams;
        }
    };
    //console.log(new Date())

    if (window.location.protocol === "chrome-extension:" ||
        window.location.host === 'button.coinawesome.com' ||
        window.location.host === 'giveaway.coinawesome.com') {
        Promise.all([
            preferences.getAddress()
        ]).then(function(values) {
            if (values[0].length === 0) {
                // no address yet
                myWallet.generateAddress()
            } else {
                myWallet.restoreAddress()
            }
        })
    }

    window.wallet = myWallet;
})(window);