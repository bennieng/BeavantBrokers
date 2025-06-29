Milestone II for Orbital 25

National University of Singapore (NUS)
CP2106 (Orbital)

Team ID:
7518
Team Name: 
BeavantBrokers 

Team Members:
Ben Nicholas Ng
Cleavant Ong Zheng Long

Proposed Level of Achievement: 

Apollo 11

Motivation 

We were inspired to undertake this project as we are both active investors. With the current state of the market, we were left wishing that we had better managed our portfolios so that we could have made less losses. 

Aim 

We hope to develop a web-based portfolio management system that helps users track and optimise their investments. At the same time, we aim to gain practical experience in web development, data integration and machine learning. 

Foreword by Developers
Welcome to BeavantBrokers! This app is crafted to revolutionise how you navigate and grow your investment journey.
As developers, we set out with a clear mission, to build an intelligent, user-friendly platform that brings clarity to the complexities of the financial markets. We recognised that investors often struggle with scattered data feeds, overwhelming charts, and missed opportunities, so we envisioned a single portal where every insight you need is just a tap away.
With BeavantBrokers, you get a comprehensive dashboard that gives you an instant snapshot of your portfolio’s performance, a customisable watchlist to track your favorite stocks with both live and historical charts, and a personal profile section that highlights key metrics on your holdings. Our smart alerts notify you when assets hit your chosen price thresholds, and our AI-powered forecasts deliver data-driven recommendations to help you refine your strategy over time.
We’ve poured our expertise and passion into building an intuitive, reliable experience, whether you’re a seasoned investor or just starting out, BeavantBrokers adapts to your needs and helps you form consistent habits with daily check-ins and timely reminders. We’re committed to listening to your feedback and evolving with the latest in fintech innovations so that BeavantBrokers remains your ultimate companion on the path to healthier, more confident investing.
Thank you for choosing BeavantBrokers, here is to your success in the markets!
With Regards,
Ben & Cleavant.


Submissions

Liftoff

Elevator Pitch Video: https://drive.google.com/file/d/1TTUJHcu_wP3GBLv7byxR2SwgEeWd0YGH/view?usp=drive_link

Poster: https://drive.google.com/file/d/1DZUH1bnwLshnxFv8y02SLe4Vk4o1SKlP/view?usp=drive_link



Milestone 1

Project Demo: https://drive.google.com/file/d/1kzdxLNP1Z6pgfGv8wwzARi48bdhIXHRG/view?usp=drive_link

Poster: https://drive.google.com/file/d/1bqH7wb6uF1U8XrS0NNK9oHlnglttDr1Q/view?usp=drive_link

Milestone 2
Project Demo: https://drive.google.com/file/d/1bQ9FbuhgjyRaJusqKe2hmxkEfvcEY-ie/view?usp=drive_link

A1 Poster: https://drive.google.com/file/d/1bPclO36nenF8A4RuacAf20tiL01D4KhV/view?usp=drive_link


Deployment
BeavantOrbits is currently hosted on Render.com as a full-stack web service. You can explore the live app anytime with the link below, with both front-end and back-end auto-built and deployed on every push. Render manages all dependency installs, environment variables and health checks, so there’s no manual server setup required.

Web App Link: https://beavantbrokers.onrender.com/


How we are different from existing platforms
Description
BeavantBrokers is your all-in-one web app for effortless, data-driven investing. Built with React on the front end and Node.js/Express on the back end, it leverages Socket.IO for real-time price streaming and a Python-powered ML microservice for short-term forecasts. Integrated with the Yahoo Finance API, BeavantBrokers lets you:
Dashboard: See your portfolio’s total value, P&L, and risk metrics at a glance.


Watchlist: Add symbols you care about and view live + historical charts side by side.


AI Forecasts: Get buy/sell/hold predictions with confidence intervals, updated automatically.


Custom Alerts: Define price thresholds and get instant notifications 


Beginner-Friendly Onboarding: Follow a step-by-step setup wizard, explore contextual tooltips, and start with a pre-populated “Starter Portfolio” to learn as you go.


Need
Most investment tools either offer basic tracking (e.g. static charts) or generic alerts, and only a handful dabble in AI-driven insights, but none seamlessly blend live data, machine learning, and onboarding for newcomers. BeavantBrokers fills this gap by:
Unified Experience


Combines live streaming, portfolio analytics, and AI forecasts in one interface.


Actionable Intelligence


Transforms raw price data into clear recommendations, complete with confidence levels.


Habit-Building Tools


Smart reminders and milestone badges help you check in regularly and reinforce good investing practices.


Designed for Beginners


Interactive tutorials guide you through every feature.


Simplified visuals and a “Starter Portfolio” of blue-chip stocks get you investing in minutes with no jargon required.


By integrating these elements, BeavantBrokers empowers both first-time investors and seasoned traders to make smarter decisions and build healthy market habits right from the browser.

User Stories

As a casual stock investor who wants to see my total portfolio value and performance trends over different timeframes (1D, 1W, 1M, 1Y), I want to be able to take stock of my portfolio easily and clearly with a glance, as well as set goals and strategies within the web app. 
I want to be able to receive notifications when stock prices move out of boundaries I have set, and have the web app keep me accountable on my strategies. 
I want to follow actionable suggestions to optimise returns and reduce risk to better manage my portfolio. 


Feature 1 (core): Comprehensive and clear portfolio overview
A dashboard that consist of all of a user’s position that they are able to view at one glance
Stocks, cash and other assets breakdown
Overall P&L
Risk status
Feature 2 (core): Real-time monitoring of stock prices
Live price feed for tickets in the user’s watchlist or portfolio, 
Prices updating every few seconds without the need for a full page reload 
Charts depicting these changes updated as well 
Feature 3 (core): My Profile page
add or remove stocks from portfolio, displays important metrics on current holdings
Feature 4 (core): ML model to attempt to predict stock prices (2 features cause its complex) (end)
ML model that generates short-term forecasts of selected stock prices and their confidence intervals 
Feature 5 (extension): Algorithm based analysis on portfolio 
Based on the user’s respective portfolio composition, the user is able to generate a risk analysis for their portfolio
Feature 6 (extension): Notifications and alerts for user-determined events 
Allow users to have customisable triggers based on price threshold, % changes and news sentiment that will send a notification when the conditions are met 
Feature 7 (extension): Tooltips for metrics and key performance indicators
Allow users to find out more about metrics and indicators that they are unfamiliar with by hovering over them

Tech Stack

React.js 
Redux 
CSS 
Axios
Node.js 
MongoDB 
Mongoose 
JSON Web Tokens 
RESTful APIs 
Git, Github
Python

Qualifications

Intermediate knowledge in backend development and machine learning. Proficient in relational databases and well-versed in building responsive web pages. 
Intermediate understanding of how to conduct data analysis and predictive analytics. 
Previously coded a telegram bot. 
CS2030, CS1010
CS50x (Online with harvard)

Software Engineering
Agile Development
To break down development process into manageable tasks
Weekly meetings to keep on track

Git and GitHub
For version control, and easy rollback when necessary
Committing often and ensuring it is communicated clear and promptly to each other to ensure we know what has been changed and why.


Test-Driven Development
We will try using TDD for all features, where we will write unit tests to validate expected behaviour, and write code to pass these tests. 


Modular and scalable architecture
We will design the web app with modular architecture in mind, dividing development into components. This will make the system scalable and easier to maintain. 

Performance optimisation
Considering the vast amounts of data we will have to deal with, performance is a key consideration. As such, we will focus on optimising backend queries for speed, and implement lazy loading and code splitting for the frontend. 

Developmental Plan / Timeline
Milestone 1 (2 Jun)
Tasks
Description
Date

Auth features
Frontend login page

18 - 24 May
Backend database, register and login features
Milestone 2 (30 Jun)

User portfolio
Frontend portfolio viewing page

25 May - 3 Jun
Backend database for each user
Stock price monitoring
Frontend stock monitoring page

1 - 12 Jun
Backend api to yahoo finance
User-customised notifications for stock price alerts
Frontend interface to customise alerts

13 - 24 Jun
Backend database and alert system
Milestone 3 (28 Jul)
ML modelling for predicting stock prices
Selection of data and training of model





26 Jun - 20 Jul
Fine tuning ML model
Algorithmic portfolio analysis
Frontend Portfolio Analysis
Backend Algorithmic Based Portfolio Analysis
Tooltips
Frontend Stock Metric Tooltips
Backend Stock Metric Tooltips
Splashdown (27 Aug)
Refinement


Refinement of features as deemed fit
21 Jul - 26 Aug



Project Log


App Demo Walkthrough
Sign up & Log in 


This is our log in page for users to both register themselves if they are new, or if they have an existing account they can proceed to login 

Registering 

This is an example of a user registering for their account 
Successful Registration


A successful registration will look like this, notifying the users about it.
Registering with an existing email 

This is what registering with an existing email will look like, notifying the users about it.



Successful Log-in

This is what the user will see if they have entered the correct email address and password for their existing accounts.
Homepage

This is what our homepage will look like after logging in.


Dashboard

This is a streamlined portfolio overview where users will see theirTotal Value, Today’s P&L, Unrealized Gains/Losses, and Cash Available. 


 
Market Watchlist



This is the market watchlist section where users can enter their desired stock to monitor, showing them the real time pricing and a chart to visualise the changes in prices that can be changed between days, weeks, months and years. 
ML Predictions

This is the stock predictions section where users are able to view the predicted price of their stocks in the future based of a machine learning model. 
My Profile

This is the My profile section where users are able to add or remove positions as you trade. It will generate your total portfolio position and calculate your profit or loss based on the current stock prices. 

Log out button
 
To log out, users can click on this button.

Redirecting back to home page after log out

Users will be redirected to this page after logging out. 

Challenges Faced:

ID
Challenges
Explanation and Actions taken
1
Missing Frontend Navigation
 
When building the web UI for BeavantBrokers, I discovered that the buttons to toggle between Dashboard, Watchlist, Predictions, Profile, and Logout simply were not rendering. After tracing through the React component tree, I realised I forgot to include the <NavLink> elements in the header layout and have not wired up the router. Adding those links into App.js and adjusting the CSS to position them properly fixed the issue and taught me to always verify that my navigation elements are present before moving on.


2
Yahoo-Finance dependency not found
While integrating the Yahoo Finance API for live price data, the server crashed with “Cannot find module yahoo-finance.” It turned out I installed the package locally but never committed it to package.json, so any fresh clone wouldn’t pull it in. The solution was to update our Continuous Integration steps to run npm install automatically on each deploy.
3
Weekend Bars for stock prices
When we initially generated the stock graphs, there were straight lines every week, which we quickly realised was the result of the market being closed on the weekend. We fixed this by changing the graphs to a categorical instead of date based and not plotting the weekend data. 
4
Visual appearance of graph
When we first load the watchlist graphs, it slowly expands and we have to wait until it fully expands before it can load the price graph. We tried fixing this for some time, but decided to leave it to a later date until we have more time. 


