# jazz-web-client

Create a .env file in the root of the application directory with the following values

    PORT=3000                                        # port of your choosing for http server
    JAZZ_URL=https://jazzcm.domain.com:9444/ccm      # full URL and port of your Jazz instance
    JAZZ_USER=yourusername                  
    JAZZ_PASS=yoursecret

**Install Node packages**

If you are behind a proxy, you'll need to run the folowing.

    npm config set proxy http://USER:PASSWORD@proxy.company.com:8080
    npm config set https-proxy http://USER:PASSWORD@proxy.company.com:8080

Run the following to download dependant modules.

    npm install

Start the application with

    node server.js

Access the application in your browser via

    http://localhost:3000
