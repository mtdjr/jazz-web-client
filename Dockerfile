FROM node:boron

WORKDIR /opt/jazz-web-client

# Install app dependencies
RUN npm install

# Bundle app source
COPY . /opt/jazz-web-client

EXPOSE 3000
CMD [ "npm", "start" ]
