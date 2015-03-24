    // Setup the wallet, page values and callbacks
    var val = '',
        address = '',
        SATOSHIS = 100000000,
        FEE = SATOSHIS * .1,
        AWEUnits = 'AWE',
        AWEMultiplier = SATOSHIS;


    function setupWallet() {

        function setQRCodes() {
            //console.log('')
            //$('#qrcode').html(createQRCodeCanvas(wallet.getAddress()));
            //$('#textAddress').text(wallet.getAddress());
        }

        wallet //.restoreAddress()
        .then(setQRCodes,
            function() {
                //console.log('generating address')
                return wallet.generateAddress();
            })
            .then(setQRCodes,
                function() {
                    alert('Failed to generate wallet. Refresh and try again.');
                })



    }
    wallet.setBalanceListener(function(balance) {
        setBalance(balance);
    });
    setupWallet();