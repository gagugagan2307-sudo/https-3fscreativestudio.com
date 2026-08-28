from flask import Flask, render_template, request, redirect, url_for, session

app = Flask(__name__)
app.secret_key = "3fs-creative-studio-session-key"

# Demo/admin credentials requested for this project.
ADMIN_USERNAME = "3FS"
ADMIN_PASSWORD = "3FS@media"

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        username = request.form.get("username", "")
        password = request.form.get("password", "")
        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            session["admin"] = username
            return redirect(url_for("dashboard"))
        error = "Invalid 3FS credentials."
    return render_template("login.html", error=error)

@app.route("/dashboard")
def dashboard():
    if "admin" not in session:
        return redirect(url_for("login"))
    return render_template("dashboard.html", username=session["admin"])

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("home"))

if __name__ == "__main__":
    app.run(debug=True)
