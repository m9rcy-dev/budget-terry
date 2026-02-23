/**
 * @class BudgetModel
 * Manages data state and business logic.
 */
class BudgetModel {
  constructor() {
    this.data = {
      allItems: { inc: [], exp: [] },
      totals: { inc: 0, exp: 0 },
      budget: 0,
      percentage: -1
    };
  }

  /**
   * Adds a new item and generates a unique ID.
   */
  addItem(type, desc, val) {
    const id = `item-${Date.now()}`; // Simple unique ID for browser env
    const newItem = { id, description: desc, value: val, percentage: -1 };
    this.data.allItems[type].push(newItem);
    return newItem;
  }

  /**
   * Deletes an item from the data structure.
   */
  deleteItem(type, id) {
    this.data.allItems[type] = this.data.allItems[type].filter(item => item.id !== id);
  }

  /**
   * Core logic for budget and percentage calculations.
   */
  calculateBudget() {
    // 1. Calculate totals using reduce
    ['inc', 'exp'].forEach(type => {
      this.data.totals[type] = this.data.allItems[type].reduce((sum, cur) => sum + cur.value, 0);
    });

    // 2. Calculate budget
    this.data.budget = this.data.totals.inc - this.data.totals.exp;

    // 3. Calculate percentages
    if (this.data.totals.inc > 0) {
      this.data.percentage = Math.round((this.data.totals.exp / this.data.totals.inc) * 100);
      this.data.allItems.exp.forEach(item => {
        item.percentage = Math.round((item.value / this.data.totals.inc) * 100);
      });
    } else {
      this.data.percentage = -1;
    }
  }

  getBudget() {
    return {
      budget: this.data.budget,
      totalInc: this.data.totals.inc,
      totalExp: this.data.totals.exp,
      percentage: this.data.percentage
    };
  }
}

/**
 * @class UIView
 * Handles all DOM manipulations and formatting.
 */
class UIView {
  constructor() {
    this.DOMstrings = {
      inputType: ".add__type",
      inputDescription: ".add__description",
      inputValue: ".add__value",
      inputBtn: ".add__btn",
      incomeContainer: ".income__list",
      expenseContainer: ".expenses__list",
      budgetLabel: ".budget__value",
      incomeLabel: ".budget__income--value",
      expensesLabel: ".budget__expenses--value",
      percentageLabel: ".budget__expenses--percentage",
      container: ".container",
      monthLabel: ".budget__title--month"
    };
  }

  /**
   * Formats numbers to currency style: + 1,234.00
   */
  formatNumber(num, type) {
    return (type === 'exp' ? '- ' : '+ ') + num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  getInputs() {
    return {
      type: document.querySelector(this.DOMstrings.inputType).value,
      description: document.querySelector(this.DOMstrings.inputDescription).value,
      value: parseFloat(document.querySelector(this.DOMstrings.inputValue).value)
    };
  }

  /**
   * Injects the HTML for a new list item into the UI.
   */
  addListItem(obj, type) {
    const container = type === 'inc' ? this.DOMstrings.incomeContainer : this.DOMstrings.expenseContainer;
    const html = `
      <div class="item clearfix" id="${type}-${obj.id}">
        <div class="item__description">${obj.description}</div>
        <div class="right clearfix">
          <div class="item__value">${this.formatNumber(obj.value, type)}</div>
          ${type === 'exp' ? `<div class="item__percentage">---</div>` : ''}
          <div class="item__delete">
            <button class="item__delete--btn"><i class="ion-ios-close-outline"></i></button>
          </div>
        </div>
      </div>`;
    document.querySelector(container).insertAdjacentHTML('beforeend', html);
  }

  deleteListItem(selectorID) {
    const el = document.getElementById(selectorID);
    el.parentElement.removeChild(el);
  }

  clearFields() {
    const fields = document.querySelectorAll(`${this.DOMstrings.inputDescription}, ${this.DOMstrings.inputValue}`);
    fields.forEach(field => field.value = "");
    fields[0].focus();
  }

  displayBudget(obj) {
    const type = obj.budget >= 0 ? 'inc' : 'exp';
    document.querySelector(this.DOMstrings.budgetLabel).textContent = this.formatNumber(obj.budget, type);
    document.querySelector(this.DOMstrings.incomeLabel).textContent = this.formatNumber(obj.totalInc, 'inc');
    document.querySelector(this.DOMstrings.expensesLabel).textContent = this.formatNumber(obj.totalExp, 'exp');
    document.querySelector(this.DOMstrings.percentageLabel).textContent = obj.percentage > 0 ? `${obj.percentage}%` : '---';
  }
}

/**
 * @class AppController
 * Bridge between Data and UI.
 */
class AppController {
  constructor(model, view) {
    this.model = model;
    this.view = view;
    this.init();
  }

  init() {
    console.log("App Started.");
    this.displayCurrentMonth();
    this.setupEventListeners();
    this.view.displayBudget({ budget: 0, totalInc: 0, totalExp: 0, percentage: -1 });
  }

  setupEventListeners() {
    const DOM = this.view.DOMstrings;
    
    // Add Item Event
    document.querySelector(DOM.inputBtn).addEventListener('click', () => this.ctrlAddItem());
    document.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.ctrlAddItem(); });

    // Delete Item Event (Event Delegation)
    document.querySelector(DOM.container).addEventListener('click', (e) => this.ctrlDeleteItem(e));
  }

  ctrlAddItem() {
    const input = this.view.getInputs();

    if (input.description !== "" && !isNaN(input.value) && input.value > 0) {
      const newItem = this.model.addItem(input.type, input.description, input.value);
      this.view.addListItem(newItem, input.type);
      this.view.clearFields();
      this.updateBudget();
    }
  }

  ctrlDeleteItem(event) {
    // Traverse up to find the ID (e.g., inc-123)
    const itemID = event.target.closest('.item')?.id;
    
    if (itemID) {
      const [type, id] = itemID.split('-');
      this.model.deleteItem(type, id);
      this.view.deleteListItem(itemID);
      this.updateBudget();
    }
  }

  updateBudget() {
    this.model.calculateBudget();
    const budget = this.model.getBudget();
    this.view.displayBudget(budget);
  }

  displayCurrentMonth() {
    const now = new Date();
    
    // Configures the format to show the full name of the month and the year
    const options = {
        month: 'long',
        year: 'numeric'
    };

    // Example output: "October 2023"
    const dateString = now.toLocaleDateString('en-US', options);

    // Select the span and update the text
    document.querySelector('.budget__title--month').textContent = dateString;
}
}

// Global Initialization
const app = new AppController(new BudgetModel(), new UIView());