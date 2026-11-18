FROM nginx:1.28.3-alpine
COPY deploy/fribench/nginx.conf /etc/nginx/nginx.conf
COPY site/ /usr/share/nginx/html/
USER 101:101
EXPOSE 8080
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
