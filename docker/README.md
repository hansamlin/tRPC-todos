# 練習 docker compose 

不同的 yml 檔案設定不同的網路

##

1. 啟動一個 postgresql service 跟一個 app service，並且主機能夠連到兩個 service 的 port
2. 啟動一個 postgresql service 跟一個 app service，並且主機只能連到 app service 暴露的 8080 port 以及 5432 port ，無法連到 app service 的 3000 port
3. 啟動一個 postgresql service 跟一個 app service，並且主機只能連到 app service 暴露的 8080 port，無法連到 app service 的 3000 port 及 postgresql service 5432 port