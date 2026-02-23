Budget Terry
A streamlined, professional budget tracking application built with Pure JavaScript (ES6+). This project has been refactored to remove all Node.js dependencies, making it 100% compatible with static hosting environments like GitHub Pages.

🚀 Key Features
Clean Code Architecture: Completely refactored using the Model-View-Controller (MVC) pattern with ES6 Classes.

Zero Dependencies: No Node.js, Express, or NPM required. Runs directly in any modern browser.

Responsive Design: Mobile-first CSS ensures you can track your expenses on the go.

Native Browser APIs: Uses Intl.NumberFormat for currency and crypto.randomUUID() for unique data identification.

🛠 How It Works
The app is split into three distinct logical layers:

BudgetModel: Handles the "Brain" of the app—calculating totals, percentages, and maintaining the data state.

UIView: Manages the "Face" of the app—DOM manipulation, event capturing, and formatting.

AppController: The "Glue" that connects the user's actions to the data logic.

📦 Local Setup
Since this app uses modern JavaScript, it is best viewed through a local server to avoid browser CORS restrictions.

Clone the Repository:

Bash
git clone https://github.com/m9rcy-dev/budget-terry.git
Launch via Live Server:

If using VS Code, right-click index.html and select "Open with Live Server".

Alternatively, use Python: python -m http.server 8000.

🌍 Deploying to GitHub Pages
GitHub Pages is a static site hosting service that takes HTML, CSS, and JavaScript files straight from a repository.

Step 1: Push your code to GitHub
Create a new repository on GitHub and push your modernized files:

Bash
git init
git add .
git commit -m "Modernize budget app for GitHub Pages"
git remote add origin https://github.com/m9rcy-dev/budget-terry.git
git push -u origin main
Step 2: Configure GitHub Pages
Go to your repository on GitHub.com.

Click on the Settings tab.

On the left sidebar, click Pages (under the "Code and automation" section).

Under Build and deployment > Branch, ensure the branch is set to main (or master) and the folder is / (root).

Click Save.

Step 3: Visit your site
GitHub will provide a URL (usually https://m9rcy-dev.github.io/budget-terry/). It may take 1–2 minutes for the site to go live.

📝 Documented Functions (Clean Code)
BudgetModel.calculateBudget()
Iterates through all income and expense items to generate the current balance. It includes safety checks to ensure percentages aren't calculated when income is zero.

UIView.formatNumber(num, type)
Uses the native toLocaleString API to ensure currency is displayed correctly across different regions without the need for external libraries like Moment.js or Numeral.js.

AppController.ctrlDeleteItem(event)
Uses Event Delegation. Instead of attaching listeners to every single list item (which is slow), it attaches one listener to the parent container and uses .closest() to identify which item was clicked.