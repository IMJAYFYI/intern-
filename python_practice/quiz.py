from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

#Fake DB
quizes = []

class Questions(BaseModel):
    question : str
    options : list[str]
    answer : str

class Quiz(BaseModel):
    title : str
    questions : list[Questions]

class Submit_answer(BaseModel):
    answer : list[str]


@app.get("/quizes")
def get_all_quizes():
    return {"quizzes": quizes}

@app.get("/quizes/{id}")
def get_quizes(id: int):
    if id >= len(quizes):
        raise HTTPException(status_code=404, detail="quiz not found")
    return quizes[id]


@app.delete("/quizes/{id}")
def delete_quiz(id: int):
    for items in quizes:
        if items["id"] == id:
            quizes.remove(items)
            return {
                    "message": "quiz deleted",
                    "deleted_quiz": items
                }
    return {"message": "quiz not found"}


@app.post("/create_quiz")
def create_quiz(quiz : Quiz): # wants the body of Quiz type 
    q_data = quiz.model_dump()
    quiz_id = len(quizes)
    quizes.append({ 
         "id": quiz_id,
        "title": q_data["title"],
        "questions": q_data["questions"]})
    
    return {
        "message" : "quiz created",
        "quiz_id" : quiz_id
    }

@app.post("/quizes/{id}/submit")
def submit_quiz(id: int, data: Submit_answer):
    if id >= len(quizes):
        raise HTTPException(status_code=404,detail="quiz not found")
    quiz = quizes[id]
    questions = quiz["questions"]
    score = 0
    for i in range(len(questions)):
        correct = questions[i]["answer"]
        if i < len(data.answer) and data.answer[i] == correct:
            score += 1
    return {
        "quiz_title": quiz["title"],
        "total_questions": len(questions),
        "score" : score
    }



        
        
    






    

    
    

    
