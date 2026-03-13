import { ComponentChildren } from "preact";
import { Head } from "$fresh/runtime.ts";

interface LayoutProps {
  title?: string;
  isAuthenticated?: boolean;
  children: ComponentChildren;
}

export default function Layout({ title, isAuthenticated, children }: LayoutProps) {
  return (
    <>
      <Head>
        <title>{title || "MDFT LMS"}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {/* Bootstrap 5 CSS */}
        <link
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
          rel="stylesheet"
          integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH"
          crossOrigin="anonymous"
        />
        {/* Bootstrap Icons */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"
        />
        {/* Google Fonts: Inter */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/css/style.css" />
      </Head>
      
      <div className="d-flex flex-column min-vh-100 bg-white">
        {/* Header / Main Menu */}
        <div className="container container-narrow">
          <nav className="navbar navbar-expand-lg navbar-white bg-white">
            <a className="navbar-brand d-flex align-items-center" href="/">
              <img
                className="mr-2"
                height="52"
                src="/img/logo.png"
                alt="MDFT LMS"
              />
            </a>
            <button
              className="navbar-toggler"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target="#navbarNav"
              aria-controls="navbarNav"
              aria-expanded="false"
              aria-label="Toggle navigation"
            >
              <span className="navbar-toggler-icon"></span>
            </button>
            <div className="collapse navbar-collapse" id="navbarNav">
              <ul className="navbar-nav ms-auto d-flex flex-row gap-4">
                <li className="nav-item">
                  <a className="nav-link text-dark" href="/">Home</a>
                </li>
                <li className="nav-item">
                  <a className="nav-link text-dark" href="/courses">Courses</a>
                </li>
                <li className="nav-item">
                  <a className="nav-link text-dark" href="/certifications">Certifications</a>
                </li>
                {isAuthenticated ? (
                  <li className="nav-item">
                    <a className="nav-link text-dark" href="/logout">Logout</a>
                  </li>
                ) : (
                  <li className="nav-item">
                    <a className="nav-link text-dark" href="/login">Login</a>
                  </li>
                )}
              </ul>
            </div>
          </nav>
        </div>

        {/* Main Content */}
        <main className="container container-narrow pb-4 flex-grow-1">
          {children}
        </main>

        {/* Footer */}
        <footer className="footer bg-dark text-light py-4 mt-5">
          <div className="container">
            <div className="row mb-4">
              <div className="col">
                <a
                  href="https://www.linkedin.com/in/markfarragher/"
                  target="_blank"
                  className="text-light me-4 text-decoration-none fs-4"
                >
                  <i className="bi bi-linkedin"></i>
                </a>
                <a
                  href="https://mdft.social/@mark"
                  target="_blank"
                  className="text-light me-4 text-decoration-none fs-4"
                >
                  <i className="bi bi-mastodon"></i>
                </a>
                <a
                  href="https://bsky.app/profile/mark.mdft.social"
                  target="_blank"
                  className="text-light text-decoration-none fs-4"
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="currentColor"
                  >
                    <title>Bluesky</title>
                    <path d="M12 10.5845C10.913 8.44406 7.954 4.45578 5.202 2.48948C2.566 0.605195 1.561 0.931224 0.902 1.23397C0.139 1.58126 0 2.76792 0 3.46453C0 4.16316 0.378 9.18522 0.624 10.0246C1.439 12.7948 4.337 13.7304 7.007 13.4307C7.143 13.4104 7.282 13.3912 7.422 13.374C7.284 13.3963 7.146 13.4145 7.007 13.4307C3.095 14.0179 -0.38 15.4608 4.177 20.5972C9.19 25.8522 11.047 19.4703 12 16.2353C12.953 19.4703 14.05 25.6223 19.733 20.5972C24 16.2353 20.905 14.0179 16.993 13.4307C16.8542 13.4151 16.7159 13.3962 16.578 13.374C16.718 13.3912 16.857 13.4104 16.993 13.4307C19.663 13.7314 22.561 12.7948 23.376 10.0246C23.622 9.18623 24 4.16215 24 3.46554C24 2.76691 23.861 1.58126 23.098 1.23194C22.439 0.930212 21.434 0.604183 18.798 2.48746C16.046 4.45679 13.087 8.44508 12 10.5845Z"></path>
                  </svg>
                </a>
              </div>
            </div>
            <div className="row align-items-center">
              <div className="col-md-6 text-center text-md-start mb-3 mb-md-0">
                <p className="mb-0 small">
                  &copy; {new Date().getFullYear()} MDFT LMS. All rights reserved.
                </p>
                <p className="mb-0 small mt-1">
                  <span className="me-1">🇪🇺</span> Hosted in the EU. This site complies with GDPR.
                </p>
              </div>
              <div className="col-md-6 text-center text-md-end">
                <a href="#" className="text-light text-decoration-none me-3 small">Privacy</a>
                <a href="#" className="text-light text-decoration-none me-3 small">Terms</a>
                <a href="#" className="text-light text-decoration-none small">Contact</a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
