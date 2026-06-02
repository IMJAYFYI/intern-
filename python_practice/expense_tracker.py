from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from datetime import date
from pathlib import Path
from typing import Literal

app = FastAPI()
BASE_DIR = Path(__file__).resolve().parent
app.mount('/static', StaticFiles(directory=BASE_DIR / 'static'), name='static')

@app.get('/')
def home():
    return FileResponse(BASE_DIR / 'static' / 'index.html')

class Transaction(BaseModel):
    type: Literal['income', 'expense']
    amount: float = Field(gt=0)
    category: str
    date: date

transactions = []

@app.post('/transactions')
def add_transaction(transaction: Transaction):
    transaction.category = transaction.category.lower()
    transactions.append(transaction)
    return {"message": "Transaction added successfully!", "data": transaction}

@app.get('/transactions')
def get_transactions(category: str = None):
    if category == None:
        return transactions
    
    search_category = category.lower()
    filtered_list = []
    
    for item in transactions:
        if item.category == search_category:
            filtered_list.append(item)
            
    return filtered_list

@app.get('/balance')
def get_balance():
    total_income = 0
    total_expense = 0
    
    for item in transactions:
        if item.type == 'income':
            total_income = total_income + item.amount
        elif item.type == 'expense':
            total_expense = total_expense + item.amount
            
    final_balance = total_income - total_expense
    
    return {
        'income': total_income,
        'expense': total_expense,
        'balance': final_balance
    }

@app.get('/summary/{year}/{month}')
def get_monthly_summary(year: int, month: int):
    monthly_income = 0
    monthly_expense = 0
    
    for item in transactions:
        if item.date.year == year and item.date.month == month:
            if item.type == 'income':
                monthly_income = monthly_income + item.amount
            elif item.type == 'expense':
                monthly_expense = monthly_expense + item.amount
                
    monthly_balance = monthly_income - monthly_expense
    
    return {
        "year": year,
        "month": month,
        "income": monthly_income,
        "expense": monthly_expense,
        "balance": monthly_balance
    }
